import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn, spawnSync } from 'child_process';
import http from 'http';
import fs from 'fs';
import dns from 'dns/promises';
import { runTool, clearAlarms, cancelCurrentTool, loadAlarms } from './agent-tools.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow = null;
let activeProcesses = new Map(); // Store active child processes by ID
let workspaceWatcher = null;    // fs.watch instance for workspace auto-refresh

// ===================== AI (Ollama) LIFECYCLE — HEMAT ENERGI =====================
// AI cuma hidup selama Nata IDE kebuka. App buka -> Ollama nyala. App tutup ->
// model di-unload dari RAM + server dimatiin (kalau kita yg start). Jadi ga ada
// proses AI yg makan RAM/baterai pas app ga dipake.

const OLLAMA_MODEL = 'qwen3:4b-instruct';
const OLLAMA_PORT = 11434;
// GUI app punya PATH minim, jadi resolve binary-nya manual.
const OLLAMA_PATH_ENV = `/opt/homebrew/bin:/usr/local/bin:${process.env.PATH || ''}`;
const OLLAMA_BIN = ['/opt/homebrew/bin/ollama', '/usr/local/bin/ollama']
  .find(p => { try { return fs.existsSync(p); } catch { return false; } }) || 'ollama';

let ollamaProc = null;        // proses `ollama serve` kalau kita yg nyalain
let ollamaStartedByUs = false;

function pingOllama() {
  return new Promise((resolve) => {
    const req = http.get(
      { host: '127.0.0.1', port: OLLAMA_PORT, path: '/api/tags', timeout: 1000 },
      (res) => { res.resume(); resolve(res.statusCode === 200); }
    );
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
  });
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function startOllama() {
  if (await pingOllama()) {
    console.log('[AI] Ollama sudah jalan, pakai yang ada.');
    return;
  }
  console.log('[AI] Menyalakan Ollama (AI auto-start)...');
  ollamaProc = spawn(OLLAMA_BIN, ['serve'], {
    env: {
      ...process.env,
      PATH: OLLAMA_PATH_ENV,
      OLLAMA_NUM_PARALLEL: '1',         // Batasi paralelisasi untuk menghemat VRAM/RAM
      OLLAMA_MAX_LOADED_MODELS: '1',     // Cukup muat 1 model saja sekaligus agar hemat memori
      OLLAMA_FLASH_ATTENTION: '1',       // Attention hemat memori (syarat KV cache quantized)
      OLLAMA_KV_CACHE_TYPE: 'q8_0'       // KV cache ~setengah RAM dibanding f16, kualitas nyaris sama
    },
    stdio: 'ignore'
  });
  ollamaStartedByUs = true;
  ollamaProc.on('error', (e) => console.error('[AI] Gagal start Ollama:', e.message));
  // Tunggu server siap (maks ~10 detik). Model BELUM di-load di sini biar ringan —
  // model baru masuk RAM pas user kirim chat pertama (lazy load = hemat).
  for (let i = 0; i < 20; i++) {
    if (await pingOllama()) { console.log('[AI] Ollama siap.'); return; }
    await sleep(500);
  }
  console.warn('[AI] Ollama belum kebaca dalam 10 detik.');
}

let aiStopped = false;
function stopOllama() {
  if (aiStopped) return;
  aiStopped = true;
  // 1. Unload model dari RAM (ini yg paling hemat energi, ~3GB balik).
  try {
    spawnSync(OLLAMA_BIN, ['stop', OLLAMA_MODEL], {
      env: { ...process.env, PATH: OLLAMA_PATH_ENV }, timeout: 5000
    });
    console.log('[AI] Model di-unload dari RAM.');
  } catch (e) { /* abaikan */ }
  // 2. Kalau servernya kita yg nyalain, matiin sekalian.
  if (ollamaStartedByUs && ollamaProc) {
    try { ollamaProc.kill(); } catch (e) { /* abaikan */ }
    ollamaProc = null;
    console.log('[AI] Server Ollama dimatiin.');
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    titleBarStyle: 'hiddenInset', // Native Mac look
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true // panel Browser Preview (localhost) di dalam IDE
    }
  });

  // In development, load the Vite dev server URL
  if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
    // Kill any remaining active processes
    for (const [id, proc] of activeProcesses.entries()) {
      try {
        proc.kill();
      } catch (e) {
        console.error(`Failed to kill process ${id}:`, e);
      }
    }
    activeProcesses.clear();
  });
}

app.whenReady().then(() => {
  createWindow();           // tampilin UI dulu biar snappy
  startOllama();            // nyalain AI di background (ga nge-block UI)
  // Arm ulang alarm yang tersimpan di ~/.nata/alarms.json (persist antar-restart)
  try { const n = loadAlarms(); if (n) console.log(`[Alarm] ${n} alarm di-arm ulang.`); } catch {}

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      aiStopped = false;     // dibuka lagi dari dock -> izinkan start ulang
      createWindow();
      startOllama();
    }
  });
});

// App ditutup = AI ikut mati (sesuai permintaan: hemat energi).
// Di Mac pun kita quit penuh biar AI bener-bener stop, ga nyangkut di background.
app.on('window-all-closed', () => {
  app.quit();
});

// Pas mau keluar: unload model + matiin server + batalin alarm yg masih nyangkut.
app.on('before-quit', stopOllama);
app.on('will-quit', () => { stopOllama(); clearAlarms(); if (workspaceWatcher) { try { workspaceWatcher.close(); } catch {} workspaceWatcher = null; } });

// --- IPC HANDLERS ---

// 0. Filesystem watcher — kirim event 'workspace-changed' ke renderer saat ada file berubah
const IGNORE_DIRS = new Set(['.git', 'node_modules', 'dist', '.next', 'build', '.cache', '__pycache__', '.DS_Store']);

ipcMain.handle('watch-workspace', async (event, { dirPath }) => {
  // Tutup watcher lama kalau ada
  if (workspaceWatcher) {
    try { workspaceWatcher.close(); } catch {}
    workspaceWatcher = null;
  }
  if (!dirPath) return { success: false };
  try {
    let debounceTimer = null;
    workspaceWatcher = fs.watch(dirPath, { recursive: true }, (eventType, filename) => {
      // Filter path yang tidak perlu dipantau (terlalu noisy)
      if (filename) {
        const parts = filename.split(path.sep);
        if (parts.some(p => IGNORE_DIRS.has(p))) return;
      }
      // Debounce 150ms supaya bulk file writes tidak flood renderer
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('workspace-changed', { dirPath });
        }
      }, 150);
    });
    workspaceWatcher.on('error', () => { workspaceWatcher = null; });
    return { success: true };
  } catch (err) {
    console.warn('[Watcher] Gagal watch workspace:', err.message);
    return { success: false, error: err.message };
  }
});

// 1. Execute terminal command
ipcMain.handle('execute-command', async (event, { command, cwd, processId }) => {
  return new Promise((resolve) => {
    console.log(`Executing: ${command} in ${cwd || process.cwd()}`);
    
    // Spawn shell to execute command
    // On Mac, we run inside zsh or bash
    const shell = process.env.SHELL || '/bin/zsh';
    // -l = login shell → load ~/.zprofile sehingga PATH Homebrew/nvm masuk
    const effectiveCwd = cwd || process.cwd();
    const child = spawn(shell, ['-l', '-c', command], {
      cwd: effectiveCwd,
      env: {
        ...process.env,
        FORCE_COLOR: '1',
        TERM: 'xterm-256color',
        // Tambah node_modules/.bin ke PATH biar npm scripts (next, react-scripts, dll) ketemu
        PATH: `${effectiveCwd}/node_modules/.bin:${process.env.PATH || ''}`,
      }
    });

    activeProcesses.set(processId, child);

    child.stdout.on('data', (data) => {
      if (mainWindow) {
        mainWindow.webContents.send(`terminal-out-${processId}`, data.toString());
      }
    });

    child.stderr.on('data', (data) => {
      if (mainWindow) {
        mainWindow.webContents.send(`terminal-err-${processId}`, data.toString());
      }
    });

    child.on('close', (code) => {
      activeProcesses.delete(processId);
      if (mainWindow) {
        mainWindow.webContents.send(`terminal-close-${processId}`, code);
      }
      resolve({ success: code === 0, code });
    });

    child.on('error', (err) => {
      activeProcesses.delete(processId);
      if (mainWindow) {
        mainWindow.webContents.send(`terminal-err-${processId}`, err.message);
      }
      resolve({ success: false, error: err.message });
    });
  });
});

// 1b. Send stdin ke proses yang lagi jalan (buat interaksi terminal)
ipcMain.handle('send-stdin', async (event, { processId, data }) => {
  const proc = activeProcesses.get(processId);
  if (!proc || !proc.stdin) return { success: false, error: 'Proses tidak ditemukan' };
  try {
    proc.stdin.write(data);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// 2. Kill running command
ipcMain.handle('kill-command', async (event, { processId }) => {
  const proc = activeProcesses.get(processId);
  if (proc) {
    proc.kill('SIGINT');
    activeProcesses.delete(processId);
    return { success: true };
  }
  return { success: false, error: 'Process not found' };
});

// 3. Read File
ipcMain.handle('read-file', async (event, { filePath }) => {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return { success: true, content };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// 3b. Read Image -> data URL (buat preview gambar di tengah)
ipcMain.handle('read-image', async (event, { filePath }) => {
  try {
    const ext = path.extname(filePath).slice(1).toLowerCase();
    const mime = ext === 'svg' ? 'svg+xml' : (ext === 'jpg' ? 'jpeg' : ext);
    const base64 = fs.readFileSync(filePath).toString('base64');
    return { success: true, dataUrl: `data:image/${mime};base64,${base64}` };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// 4. Write File
ipcMain.handle('write-file', async (event, { filePath, content }) => {
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, content, 'utf-8');
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// 4b. File ops ala VS Code — buat folder, hapus, rename
ipcMain.handle('fs-mkdir', async (event, { dirPath }) => {
  try {
    if (fs.existsSync(dirPath)) return { success: false, error: 'Folder/file dengan nama itu sudah ada' };
    fs.mkdirSync(dirPath, { recursive: true });
    return { success: true };
  } catch (err) { return { success: false, error: err.message }; }
});

ipcMain.handle('fs-create-file', async (event, { filePath }) => {
  try {
    if (fs.existsSync(filePath)) return { success: false, error: 'File sudah ada' };
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, '', 'utf-8');
    return { success: true };
  } catch (err) { return { success: false, error: err.message }; }
});

ipcMain.handle('fs-rename', async (event, { oldPath, newPath }) => {
  try {
    if (fs.existsSync(newPath)) return { success: false, error: 'Nama itu sudah dipakai' };
    fs.renameSync(oldPath, newPath);
    return { success: true };
  } catch (err) { return { success: false, error: err.message }; }
});

ipcMain.handle('fs-delete', async (event, { targetPath }) => {
  try {
    fs.rmSync(targetPath, { recursive: true, force: true });
    return { success: true };
  } catch (err) { return { success: false, error: err.message }; }
});

// Git action — jalanin subcommand git yg aman (add/commit/push/pull/checkout/branch/stash) di repo root
ipcMain.handle('git-action', async (event, { root, action, message, branch }) => {
  const run = (args) => new Promise((resolve) => {
    const child = spawn('git', args, { cwd: root, env: { ...process.env } });
    let out = '', err = '';
    child.stdout.on('data', d => out += d.toString());
    child.stderr.on('data', d => err += d.toString());
    child.on('close', code => resolve({ code, out, err }));
    child.on('error', e => resolve({ code: 1, out: '', err: e.message }));
  });
  try {
    if (action === 'commit') {
      const add = await run(['add', '-A']);
      if (add.code !== 0) return { success: false, error: add.err || 'git add gagal' };
      const c = await run(['commit', '-m', message || 'update']);
      if (c.code !== 0) return { success: false, error: (c.err || c.out || 'commit gagal').trim() };
      return { success: true, output: c.out.trim() };
    }
    if (action === 'push')   { const r = await run(['push']);  return r.code === 0 ? { success: true, output: (r.out + r.err).trim() } : { success: false, error: (r.err || r.out).trim() }; }
    if (action === 'pull')   { const r = await run(['pull']);  return r.code === 0 ? { success: true, output: (r.out + r.err).trim() } : { success: false, error: (r.err || r.out).trim() }; }
    if (action === 'checkout' && branch) { const r = await run(['checkout', branch]); return r.code === 0 ? { success: true } : { success: false, error: (r.err || r.out).trim() }; }
    if (action === 'diff') { await run(['add', '-A']); const r = await run(['diff', '--cached']); return { success: true, output: (r.out || '').slice(0, 6000) }; }
    // List all branches (local)
    if (action === 'branches') {
      const r = await run(['branch', '--no-color']);
      if (r.code !== 0) return { success: false, error: (r.err || r.out).trim() };
      const branches = r.out.split('\n').filter(Boolean).map(b => ({ name: b.replace(/^\*?\s*/, '').trim(), current: b.startsWith('*') }));
      return { success: true, branches };
    }
    // Create new branch & switch to it
    if (action === 'create-branch' && branch) {
      const r = await run(['checkout', '-b', branch]);
      return r.code === 0 ? { success: true, output: (r.out + r.err).trim() } : { success: false, error: (r.err || r.out).trim() };
    }
    // Stash changes
    if (action === 'stash') {
      const r = await run(['stash', 'push', '-m', message || 'Nata stash']);
      return r.code === 0 ? { success: true, output: (r.out + r.err).trim() } : { success: false, error: (r.err || r.out).trim() };
    }
    // Pop stash
    if (action === 'stash-pop') {
      const r = await run(['stash', 'pop']);
      return r.code === 0 ? { success: true, output: (r.out + r.err).trim() } : { success: false, error: (r.err || r.out).trim() };
    }
    return { success: false, error: 'aksi tidak dikenal' };
  } catch (e) { return { success: false, error: e.message }; }
});

// List semua file (rekursif) buat Quick Open Cmd+P — skip folder berat
ipcMain.handle('list-files', async (event, { root, max = 5000 }) => {
  const SKIP = new Set(['node_modules', '.git', 'dist', 'dist-electron', '.next', 'build', 'out', '.cache', '.turbo', 'coverage', '.venv', '__pycache__']);
  const files = [];
  const walk = (dir) => {
    if (files.length >= max) return;
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (files.length >= max) break;
      if (e.name.startsWith('.') && e.name !== '.env') { if (SKIP.has(e.name)) continue; }
      const full = path.join(dir, e.name);
      if (e.isDirectory()) { if (!SKIP.has(e.name)) walk(full); }
      else files.push({ path: full, name: e.name, rel: path.relative(root, full) });
    }
  };
  try { walk(root); return { success: true, files }; }
  catch (err) { return { success: false, error: err.message, files: [] }; }
});

ipcMain.handle('fs-reveal', async (event, { targetPath }) => {
  try { shell.showItemInFolder(targetPath); return { success: true }; }
  catch (err) { return { success: false, error: err.message }; }
});

ipcMain.handle('fs-duplicate', async (event, { targetPath }) => {
  try {
    const dir = path.dirname(targetPath);
    const ext = path.extname(targetPath);
    const base = path.basename(targetPath, ext);
    let dest = path.join(dir, `${base} copy${ext}`);
    let i = 2;
    while (fs.existsSync(dest)) { dest = path.join(dir, `${base} copy ${i}${ext}`); i++; }
    fs.cpSync(targetPath, dest, { recursive: true });
    return { success: true, path: dest };
  } catch (err) { return { success: false, error: err.message }; }
});

ipcMain.handle('fs-copy', async (event, { src, dest }) => {
  try {
    fs.cpSync(src, dest, { recursive: true });
    return { success: true };
  } catch (err) { return { success: false, error: err.message }; }
});

ipcMain.handle('search-replace-in-files', async (event, { root, query, replacement, regex }) => {
  if (!root || !query) return { success: false, error: 'root and query required' };
  let filesReplaced = 0;
  let occurencesReplaced = 0;
  const walk = (dir) => {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const ent of entries) {
      if (ent.name.startsWith('.') && ent.name !== '.env') continue;
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        if (!SKIP_DIRS.has(ent.name)) walk(full);
        continue;
      }
      let stat;
      try { stat = fs.statSync(full); } catch { continue; }
      if (stat.size > 1024 * 1024) continue;
      let content;
      try { content = fs.readFileSync(full, 'utf-8'); } catch { continue; }
      if (content.includes('\0')) continue;
      
      let newContent;
      let count = 0;
      if (regex) {
        try {
          const re = new RegExp(query, 'g');
          const matches = content.match(re);
          if (matches) {
            count = matches.length;
            newContent = content.replace(re, replacement || '');
          }
        } catch (e) {
          throw new Error(`Invalid regex: ${e.message}`);
        }
      } else {
        if (content.includes(query)) {
          let pos = content.indexOf(query);
          while (pos !== -1) {
            count++;
            pos = content.indexOf(query, pos + query.length);
          }
          newContent = content.split(query).join(replacement || '');
        }
      }
      
      if (count > 0 && newContent !== undefined) {
        fs.writeFileSync(full, newContent, 'utf-8');
        filesReplaced++;
        occurencesReplaced += count;
      }
    }
  };
  try {
    walk(root);
    return { success: true, filesReplaced, occurencesReplaced };
  } catch (err) { return { success: false, error: err.message }; }
});

ipcMain.handle('git-blame', async (event, { root, filePath, line }) => {
  const run = (args) => new Promise((resolve) => {
    const child = spawn('git', args, { cwd: root, env: { ...process.env } });
    let out = '', err = '';
    child.stdout.on('data', d => out += d.toString());
    child.stderr.on('data', d => err += d.toString());
    child.on('close', code => resolve({ code, out, err }));
    child.on('error', e => resolve({ code: 1, out: '', err: e.message }));
  });
  try {
    const relPath = path.relative(root, filePath);
    const res = await run(['blame', '-L', `${line},${line}`, '--porcelain', relPath]);
    if (res.code !== 0) return { success: false, error: res.err || 'git blame failed' };
    const lines = res.out.split('\n');
    let author = 'Unknown';
    let summary = '';
    let time = '';
    for (const l of lines) {
      if (l.startsWith('author ')) author = l.slice(7).trim();
      if (l.startsWith('summary ')) summary = l.slice(8).trim();
      if (l.startsWith('author-time ')) {
        const timestamp = parseInt(l.slice(12).trim(), 10);
        if (!isNaN(timestamp)) {
          time = new Date(timestamp * 1000).toLocaleDateString();
        }
      }
    }
    return { success: true, author, summary, time };
  } catch (err) { return { success: false, error: err.message }; }
});

// 5. Read Directory
ipcMain.handle('read-dir', async (event, { dirPath }) => {
  try {
    const targetPath = dirPath || process.cwd();
    const files = fs.readdirSync(targetPath, { withFileTypes: true });
    
    const result = files.map(file => ({
      name: file.name,
      isDir: file.isDirectory(),
      path: path.join(targetPath, file.name)
    }));

    return { success: true, files: result, currentPath: targetPath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// 6. Get system details (username, home dir, working dir)
ipcMain.handle('get-system-info', async () => {
  const { userInfo, hostname } = await import('os');
  const info = userInfo();
  return {
    cwd: process.cwd(),
    home: app.getPath('home'),
    platform: process.platform,
    username: info.username || 'user',
    hostname: hostname().replace(/\.local$/, ''),
  };
});

// 7. Run an agent tool (dokumen, gambar+OCR, scraping, notifikasi/alarm, generate_image).
// onProgress → kirim event 'tool-progress' ke renderer buat update UI live.
ipcMain.handle('run-tool', async (event, { name, args, cwd }) => {
  const onProgress = (msg) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('tool-progress', msg);
    }
  };
  return runTool(name, args || {}, { cwd: cwd || process.cwd(), onProgress });
});

// 7b. Cancel tool yang lagi jalan (bunuh subprocess Python, termasuk whisper STT).
let _sttProc = null;
ipcMain.handle('cancel-tool', async () => {
  cancelCurrentTool();
  try { _sttProc?.kill(); } catch {}
  _sttProc = null;
  return { success: true };
});

// 7c. TTS lokal via `say` bawaan macOS — buat mode Suara (AI ngejelasin kerjaannya).
let _sayProc = null;
ipcMain.handle('tts-speak', async (event, { text, voice, interrupt = true }) => {
  try {
    if (interrupt && _sayProc) { try { _sayProc.kill(); } catch {} _sayProc = null; }
    const clean = String(text || '').slice(0, 800).trim();
    if (!clean) return { success: true };
    // args array (bukan shell) = aman dari injection
    _sayProc = spawn('/usr/bin/say', ['-v', String(voice || 'Damayanti'), clean]);
    _sayProc.on('close', () => { _sayProc = null; });
    _sayProc.on('error', () => { _sayProc = null; });
    return { success: true };
  } catch (err) { return { success: false, error: err.message }; }
});
ipcMain.handle('tts-stop', async () => {
  try { _sayProc?.kill(); } catch {}
  _sayProc = null;
  return { success: true };
});
// 7d. STT lokal (faster-whisper via venv python) — telinga buat popup ngobrol suara.
// Path dicari di 2 tempat: dalam app (dev) & folder source (app terpaket, python-agent gak ikut asar).
const PY_AGENT_CANDIDATES = [
  path.join(__dirname, 'python-agent'),
  '/Users/indragandi/Developer/Nata IDE/python-agent',
];
ipcMain.handle('stt-transcribe', async (event, { b64, ext = 'webm' }) => {
  try {
    const agentDir = PY_AGENT_CANDIDATES.find(d => fs.existsSync(path.join(d, 'venv', 'bin', 'python')));
    if (!agentDir) return { success: false, error: 'Whisper belum terpasang (python-agent/venv tidak ditemukan)' };
    const tmp = path.join(app.getPath('temp'), `nata-voice-${Date.now()}.${ext}`);
    fs.writeFileSync(tmp, Buffer.from(b64, 'base64'));
    return await new Promise((resolve) => {
      const child = spawn(path.join(agentDir, 'venv', 'bin', 'python'), [path.join(agentDir, 'tools', 'stt.py'), '--audio', tmp]);
      _sttProc = child; // biar bisa dibatalin dari tombol ⏹ (cancel-tool)
      let out = '', err = '';
      child.stdout.on('data', d => { out += d.toString(); });
      child.stderr.on('data', d => { err += d.toString(); });
      const to = setTimeout(() => { try { child.kill(); } catch {} }, 90000);
      child.on('close', () => {
        clearTimeout(to);
        try { fs.unlinkSync(tmp); } catch {}
        const m = out.match(/TEXT:([\s\S]*)/);
        if (m) resolve({ success: true, text: m[1].trim() });
        else resolve({ success: false, error: (err || out).slice(-300) || 'transkrip kosong' });
      });
      child.on('error', (e) => { clearTimeout(to); resolve({ success: false, error: e.message }); });
    });
  } catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('tts-voices', async () => {
  try {
    const out = spawnSync('/usr/bin/say', ['-v', '?'], { timeout: 5000 }).stdout?.toString() || '';
    const voices = out.split('\n').map(l => {
      const m = l.match(/^(\S[^ ]*(?: [^ ]+)*?)\s{2,}([a-z]{2}_[A-Z]{2})/);
      return m ? { name: m[1].trim(), lang: m[2] } : null;
    }).filter(Boolean);
    return { success: true, voices };
  } catch (err) { return { success: false, voices: [], error: err.message }; }
});

// 8. Open Folder — dialog pilih folder buat dijadiin workspace.
ipcMain.handle('open-folder', async () => {
  const res = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory'],
    title: 'Buka Folder Project'
  });
  if (res.canceled || !res.filePaths.length) return { canceled: true };
  return { canceled: false, path: res.filePaths[0] };
});

// 9. Search in files — walk workspace, cari teks (case-insensitive).
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'dist-electron', '.cache', 'venv', '__pycache__', '.next', 'build']);
ipcMain.handle('search-in-files', async (event, { root, query, max = 200 }) => {
  if (!root || !query) return { results: [], truncated: false };
  const q = query.toLowerCase();
  const results = [];
  let truncated = false;

  const walk = (dir) => {
    if (truncated) return;
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const ent of entries) {
      if (truncated) return;
      if (ent.name.startsWith('.') && ent.name !== '.env') continue;
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        if (!SKIP_DIRS.has(ent.name)) walk(full);
        continue;
      }
      let stat;
      try { stat = fs.statSync(full); } catch { continue; }
      if (stat.size > 1024 * 1024) continue; // lewati file > 1MB
      let content;
      try { content = fs.readFileSync(full, 'utf-8'); } catch { continue; }
      if (content.includes('\0')) continue; // skip biner
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].toLowerCase().includes(q)) {
          results.push({ file: full, line: i + 1, text: lines[i].trim().slice(0, 200) });
          if (results.length >= max) { truncated = true; break; }
        }
      }
    }
  };
  walk(root);
  return { results, truncated };
});

// 10. Git status — branch + perubahan di workspace.
ipcMain.handle('git-status', async (event, { root }) => {
  if (!root) return { isRepo: false };
  const run = (args) => {
    const r = spawnSync('git', ['-C', root, ...args], { encoding: 'utf-8', timeout: 5000 });
    return r.status === 0 ? r.stdout.trim() : null;
  };
  const branch = run(['rev-parse', '--abbrev-ref', 'HEAD']);
  if (branch === null) return { isRepo: false };
  const porcelain = run(['status', '--porcelain']) || '';
  const files = porcelain.split('\n').filter(Boolean).map(l => ({
    status: l.slice(0, 2).trim(),
    path: l.slice(3)
  }));
  return { isRepo: true, branch, files };
});

// 12. List skills dari .nata/skills/ di workspace + ~/.nata/skills/ global
ipcMain.handle('list-skills', async (event, { workspaceRoot }) => {
  const { userInfo } = await import('os');
  const homeDir = userInfo().homedir;
  const dirs = [];
  if (workspaceRoot) dirs.push({ dir: path.join(workspaceRoot, '.nata', 'skills'), scope: 'project' });
  dirs.push({ dir: path.join(homeDir, '.nata', 'skills'), scope: 'global' });

  const skills = [];
  for (const { dir, scope } of dirs) {
    if (!fs.existsSync(dir)) continue;
    let files;
    try { files = fs.readdirSync(dir).filter(f => f.endsWith('.md')); } catch { continue; }
    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(dir, file), 'utf-8');
        const fm = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
        let name = file.replace('.md', '');
        let description = '';
        let prompt = content;
        if (fm) {
          const hdr = fm[1];
          prompt = fm[2].trim();
          const nm = hdr.match(/^name:\s*(.+)$/m);
          const dm = hdr.match(/^description:\s*(.+)$/m);
          if (nm) name = nm[1].trim();
          if (dm) description = dm[1].trim();
        }
        skills.push({ name, description, prompt, scope, filePath: path.join(dir, file) });
      } catch {}
    }
  }
  return { success: true, skills };
});

// 13. Install skills dari GitHub repo URL atau raw .md URL
ipcMain.handle('install-skill', async (event, { url, workspaceRoot }) => {
  const { userInfo, tmpdir } = await import('os');
  const targetDir = workspaceRoot
    ? path.join(workspaceRoot, '.nata', 'skills')
    : path.join(userInfo().homedir, '.nata', 'skills');
  if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

  // Clone repo lalu copy .md file-nya
  return new Promise((resolve) => {
    const tempDir = path.join(tmpdir(), `nata-skill-${Date.now()}`);
    const child = spawn('git', ['clone', '--depth=1', url, tempDir], {
      env: { ...process.env, PATH: OLLAMA_PATH_ENV }
    });
    let stderr = '';
    child.stderr?.on('data', d => { stderr += d.toString(); });
    child.on('close', (code) => {
      if (code !== 0) return resolve({ success: false, error: stderr || `git clone gagal (kode ${code})` });
      // Cari .md di .nata/skills/, .claude/commands/, skills/, atau root
      const candidates = [
        path.join(tempDir, '.nata', 'skills'),
        path.join(tempDir, '.claude', 'commands'),
        path.join(tempDir, 'skills'),
        tempDir,
      ];
      let copied = 0;
      for (const srcDir of candidates) {
        if (!fs.existsSync(srcDir)) continue;
        let files;
        try { files = fs.readdirSync(srcDir).filter(f => f.endsWith('.md') && !['README.md', 'readme.md'].includes(f)); }
        catch { continue; }
        for (const file of files) {
          try { fs.copyFileSync(path.join(srcDir, file), path.join(targetDir, file)); copied++; } catch {}
        }
        if (copied > 0) break;
      }
      try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
      if (copied === 0) return resolve({ success: false, error: 'Tidak ada file skill (.md) ditemukan di repo ini.' });
      resolve({ success: true, count: copied });
    });
    child.on('error', (e) => resolve({ success: false, error: e.message }));
  });
});

// 14. Buat skill baru secara manual
ipcMain.handle('create-skill', async (event, { name, description, prompt, workspaceRoot }) => {
  const { userInfo } = await import('os');
  const targetDir = workspaceRoot
    ? path.join(workspaceRoot, '.nata', 'skills')
    : path.join(userInfo().homedir, '.nata', 'skills');
  if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
  const slug = name.replace(/\s+/g, '-').toLowerCase();
  const filePath = path.join(targetDir, `${slug}.md`);
  const content = `---\nname: ${slug}\ndescription: ${description}\n---\n\n${prompt}`;
  try { fs.writeFileSync(filePath, content, 'utf-8'); return { success: true, filePath }; }
  catch (e) { return { success: false, error: e.message }; }
});

// 15. Hapus skill
ipcMain.handle('delete-skill', async (event, { filePath }) => {
  try { fs.unlinkSync(filePath); return { success: true }; }
  catch (e) { return { success: false, error: e.message }; }
});

// 11. Clone repository — git clone <url> ke dalam <dest>.
ipcMain.handle('clone-repo', async (event, { url, dest }) => {
  return new Promise((resolve) => {
    const child = spawn('git', ['clone', url], { cwd: dest, env: { ...process.env } });
    let err = '';
    child.stderr.on('data', d => { err += d.toString(); });
    child.on('close', (code) => {
      if (code !== 0) return resolve({ success: false, error: err || `git clone keluar kode ${code}` });
      // tebak nama folder hasil clone dari URL
      const name = (url.split('/').pop() || 'repo').replace(/\.git$/, '');
      resolve({ success: true, path: path.join(dest, name) });
    });
    child.on('error', (e) => resolve({ success: false, error: e.message }));
  });
});

// ===================== WEB ACCESS — AMAN (anti-SSRF/anti-hack) =====================
// Prinsip keamanan:
// - Cuma http/https. Blok IP privat/lokal (anti-SSRF): localhost, 127.*, 10.*,
//   172.16-31.*, 192.168.*, 169.254.* (metadata cloud), ::1, fc00::/7.
// - Konten cuma diambil sebagai TEKS untuk AI; TIDAK PERNAH dieksekusi (no JS).
// - Timeout 10s, batas ukuran 1MB, redirect dibatasi, User-Agent generik.
// - Offline: kalau gagal konek, balikin { offline:true } biar AI lanjut tanpa error.

const isPrivateIp = (ip) => {
  if (!ip) return true;
  if (ip === '::1' || ip.startsWith('fc') || ip.startsWith('fd') || ip.startsWith('fe80')) return true;
  const p = ip.split('.').map(Number);
  if (p.length !== 4) return false;
  const [a, b] = p;
  if (a === 127 || a === 10 || a === 0) return true;
  if (a === 169 && b === 254) return true;            // link-local / metadata
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;  // CGNAT
  return false;
};

// Validasi URL + resolusi DNS → pastikan tujuan bukan IP privat.
const assertSafeUrl = async (raw) => {
  let u;
  try { u = new URL(raw); } catch { throw new Error('URL tidak valid'); }
  if (!/^https?:$/.test(u.protocol)) throw new Error('Hanya http/https diizinkan');
  const host = u.hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) throw new Error('Host lokal diblokir');
  if (/^[\d.]+$/.test(host) || host.includes(':')) {
    if (isPrivateIp(host)) throw new Error('IP privat diblokir');
  } else {
    const recs = await dns.lookup(host, { all: true });
    if (recs.some(r => isPrivateIp(r.address))) throw new Error('Domain mengarah ke IP privat (diblokir)');
  }
  return u.toString();
};

const htmlToText = (html) => html
  .replace(/<script[\s\S]*?<\/script>/gi, '')
  .replace(/<style[\s\S]*?<\/style>/gi, '')
  .replace(/<\/(p|div|li|h[1-6]|tr|br)>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
  .replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();

const fetchText = async (url, maxBytes = 1_000_000) => {
  const safe = await assertSafeUrl(url);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10000);
  try {
    const res = await fetch(safe, {
      signal: ctrl.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'NataIDE/1.0 (local dev assistant)', 'Accept': 'text/html,application/json,text/plain' },
    });
    const buf = await res.arrayBuffer();
    const slice = Buffer.from(buf).slice(0, maxBytes).toString('utf8');
    return { status: res.status, contentType: res.headers.get('content-type') || '', body: slice };
  } finally { clearTimeout(timer); }
};

// Ambil & bersihkan isi sebuah URL.
ipcMain.handle('web-fetch', async (event, { url }) => {
  try {
    const { status, contentType, body } = await fetchText(url);
    const text = /json/.test(contentType) ? body : htmlToText(body);
    return { success: true, status, url, text: text.slice(0, 8000) };
  } catch (e) {
    const offline = /fetch failed|ENOTFOUND|EAI_AGAIN|abort|network/i.test(e.message);
    return { success: false, offline, error: e.message };
  }
});

// Cek update — ambil version.json dari URL (default: bisa diubah user). Bandingin sama versi app.
// Catatan: tanpa code-signing macOS, install akhir tetap manual (buka DMG). Ini otomatisin cek+download.
ipcMain.handle('check-update', async (event, { feedUrl }) => {
  try {
    const url = feedUrl || process.env.NATA_UPDATE_FEED || '';
    if (!url) return { success: false, error: 'Belum ada URL update feed. Set di Settings.' };
    const res = await fetch(url, { headers: { 'User-Agent': 'NataIDE' } });
    const data = await res.json();
    const latest = (data.version || '').replace(/^v/, '');
    const current = app.getVersion();
    const newer = latest && latest !== current && latest.localeCompare(current, undefined, { numeric: true }) > 0;
    return { success: true, current, latest, newer, url: data.url || data.dmg || '', notes: data.notes || '' };
  } catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('open-external', async (event, { url }) => {
  try { await shell.openExternal(url); return { success: true }; }
  catch (e) { return { success: false, error: e.message }; }
});

// Web search via DuckDuckGo HTML (tanpa API key). Balikin judul + url.
ipcMain.handle('web-search', async (event, { query }) => {
  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const { body } = await fetchText(url, 600_000);
    const results = [];
    const re = /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    let m;
    while ((m = re.exec(body)) && results.length < 6) {
      let link = m[1];
      const dd = link.match(/uddg=([^&]+)/);            // DDG redirect → URL asli
      if (dd) { try { link = decodeURIComponent(dd[1]); } catch {} }
      const title = htmlToText(m[2]);
      if (title && /^https?:/.test(link)) results.push({ title, url: link });
    }
    return { success: true, query, results };
  } catch (e) {
    const offline = /fetch failed|ENOTFOUND|EAI_AGAIN|abort|network/i.test(e.message);
    return { success: false, offline, error: e.message };
  }
});
