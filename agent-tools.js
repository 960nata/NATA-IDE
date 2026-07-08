// agent-tools.js — registry tool buat Nata IDE (main process, ESM).
// Semua fitur "non-coding" tinggal di sini biar main.js tetap ramping:
// dokumen (Word/PDF/PPT), gambar + OCR, web scraping, notifikasi & alarm.
//
// Tiap tool: async (args, ctx) => string  (teks hasil yg ramah dibaca user/AI).
// ctx = { cwd } -> dipakai resolve path relatif.

import path from 'path';
import fs from 'fs';
import { getHubData, fetchMaterials, learnItem, addCustomItem, getRecentLessons } from './learning-hub.js';

// __dirname equivalent untuk ESM — pakai URL parsing biar aman di Electron 20/31.
const __dirname = path.dirname(new URL(import.meta.url).pathname);

// Subprocess yang sedang jalan (bisa di-cancel).
let _activeChild = null;

export function cancelCurrentTool() {
  if (_activeChild) {
    try { _activeChild.kill('SIGTERM'); } catch {}
    _activeChild = null;
  }
}

// --- helper umum ---------------------------------------------------------

// Resolve path output: absolut dipakai apa adanya, relatif diukur dari cwd.
// `subdir` (mis. "Dokumen"/"Gambar") dipakai HANYA kalau user kasih nama file
// polos tanpa folder — biar hasil kerapian tanpa maksa kalau path udah eksplisit.
function resolveOut(p, cwd, subdir) {
  let rel = p;
  if (subdir && !path.isAbsolute(p) && path.dirname(p) === '.') {
    rel = path.join(subdir, p);
  }
  const target = path.isAbsolute(rel) ? rel : path.join(cwd || process.cwd(), rel);
  
  // Batasi akses berkas (Sandboxing) ke dalam workspace jika cwd ditentukan
  if (cwd) {
    const relative = path.relative(cwd, target);
    if (relative.startsWith('..')) {
      throw new Error(`Akses ditolak: Target berkas "${p}" di luar workspace.`);
    }
  }

  const dir = path.dirname(target);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return target;
}

// Resolve path input (file yg harus sudah ada).
function resolveIn(p, cwd) {
  const target = path.isAbsolute(p) ? p : path.join(cwd || process.cwd(), p);
  
  // Batasi akses berkas (Sandboxing) ke dalam workspace jika cwd ditentukan
  if (cwd) {
    const relative = path.relative(cwd, target);
    if (relative.startsWith('..')) {
      throw new Error(`Akses ditolak: Target berkas "${p}" di luar workspace.`);
    }
  }

  if (!fs.existsSync(target)) throw new Error(`File nggak ketemu: ${target}`);
  return target;
}

function ensureExt(name, ext) {
  return name.toLowerCase().endsWith(ext) ? name : name + ext;
}

// --- DOKUMEN -------------------------------------------------------------

async function create_word({ filename = 'dokumen.docx', title = '', content = [] }, ctx) {
  const { Document, Packer, Paragraph, HeadingLevel } = await import('docx');
  const children = [];
  if (title) children.push(new Paragraph({ text: title, heading: HeadingLevel.TITLE }));
  for (const para of content) children.push(new Paragraph({ text: String(para) }));

  const doc = new Document({ sections: [{ children }] });
  const buf = await Packer.toBuffer(doc);
  const out = resolveOut(ensureExt(filename, '.docx'), ctx.cwd, 'Dokumen');
  fs.writeFileSync(out, buf);
  return `✅ File Word dibuat: ${out}`;
}

async function create_pdf({ filename = 'dokumen.pdf', title = '', content = [] }, ctx) {
  const { default: PDFDocument } = await import('pdfkit');
  const out = resolveOut(ensureExt(filename, '.pdf'), ctx.cwd, 'Dokumen');
  const doc = new PDFDocument({ margin: 50 });
  const stream = fs.createWriteStream(out);
  doc.pipe(stream);
  if (title) doc.fontSize(20).text(title, { align: 'left' }).moveDown();
  doc.fontSize(12);
  for (const para of content) doc.text(String(para)).moveDown(0.5);
  doc.end();
  await new Promise((res, rej) => { stream.on('finish', res); stream.on('error', rej); });
  return `✅ File PDF dibuat: ${out}`;
}

async function create_pptx({ filename = 'presentasi.pptx', title = '', slides = [] }, ctx) {
  const { default: PptxGenJS } = await import('pptxgenjs');
  const pptx = new PptxGenJS();

  if (title) {
    const s = pptx.addSlide();
    s.addText(title, { x: 0.5, y: 2.2, w: 9, h: 1.2, fontSize: 36, bold: true, align: 'center' });
  }
  for (const item of slides) {
    const s = pptx.addSlide();
    if (item.title) s.addText(String(item.title), { x: 0.5, y: 0.3, w: 9, h: 0.8, fontSize: 26, bold: true });
    const bullets = (item.bullets || []).map(b => ({ text: String(b), options: { bullet: true } }));
    if (bullets.length) s.addText(bullets, { x: 0.7, y: 1.3, w: 8.6, h: 4.5, fontSize: 16 });
  }
  const out = resolveOut(ensureExt(filename, '.pptx'), ctx.cwd, 'Dokumen');
  await pptx.writeFile({ fileName: out });
  return `✅ File PowerPoint dibuat: ${out}`;
}

// --- GAMBAR + OCR --------------------------------------------------------

async function image_resize({ input, output, width, height }, ctx) {
  const { default: sharp } = await import('sharp');
  const src = resolveIn(input, ctx.cwd);
  const out = resolveOut(output || input, ctx.cwd, 'Gambar');
  await sharp(src)
    .resize(width ? Number(width) : null, height ? Number(height) : null, { fit: 'inside' })
    .toFile(out);
  return `✅ Gambar di-resize: ${out}`;
}

async function image_convert({ input, output, format }, ctx) {
  const { default: sharp } = await import('sharp');
  const src = resolveIn(input, ctx.cwd);
  const fmt = (format || 'png').toLowerCase();
  const out = resolveOut(output || input.replace(/\.[^.]+$/, '.' + fmt), ctx.cwd, 'Gambar');
  await sharp(src).toFormat(fmt).toFile(out);
  return `✅ Gambar dikonversi ke ${fmt}: ${out}`;
}

async function image_ocr({ input, lang = 'eng' }, ctx) {
  const { createWorker } = await import('tesseract.js');
  const src = resolveIn(input, ctx.cwd);
  const worker = await createWorker(lang);
  try {
    const { data: { text } } = await worker.recognize(src);
    const clean = (text || '').trim();
    return clean
      ? `📝 Teks dari gambar (${path.basename(src)}):\n\n${clean}`
      : `(Nggak ada teks kebaca di ${path.basename(src)})`;
  } finally {
    await worker.terminate();
  }
}

// --- WEB SCRAPING --------------------------------------------------------

async function scrape({ url, selector }, _ctx) {
  if (!url) throw new Error('Butuh "url".');
  const { default: axios } = await import('axios');
  const cheerio = await import('cheerio');
  const { data } = await axios.get(url, {
    timeout: 20000,
    headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh) NataIDE/1.0' }
  });
  const $ = cheerio.load(data);

  // Fallback data SPA Next/Nuxt sebelum script-script dihapus
  let extraText = '';
  $('script[type="application/json"]').each((i, el) => {
    const id = $(el).attr('id');
    if (id === '__NEXT_DATA__' || id === '__NUXT_DATA__') {
      try {
        const json = JSON.parse($(el).html());
        const extractStrings = (obj) => {
          let res = [];
          const walk = (x) => {
            if (typeof x === 'string') {
              const val = x.trim();
              if (val.length > 15 && !val.includes('{') && !val.includes('}')) res.push(val);
            } else if (typeof x === 'object' && x !== null) {
              for (const k in x) walk(x[k]);
            }
          };
          walk(obj);
          return [...new Set(res)].join('\n');
        };
        const parsed = extractStrings(json);
        if (parsed.length > 50) {
          extraText += '\n\n[Parsed SPA Data]:\n' + parsed.slice(0, 4000);
        }
      } catch {}
    }
  });

  $('script, style, noscript').remove();
  const root = selector ? $(selector) : $('body');
  const text = root.text().replace(/[ \t]+/g, ' ').replace(/\n\s*\n\s*\n+/g, '\n\n').trim();
  const combined = (text + extraText).trim();
  const max = 8000;
  const clipped = combined.length > max ? combined.slice(0, max) + '\n…(dipotong)' : combined;
  return `🌐 Hasil scrape ${url}:\n\n${clipped || '(kosong)'}`;
}

// --- NOTIFIKASI, ALARM & AGENDA (ala Cowork) -------------------------------
// Alarm PERSIST ke ~/.nata/alarms.json — tetap hidup walau app di-restart
// (di-arm ulang lewat loadAlarms() dari main.js). Support jam absolut ("15:00"),
// harian, dan berulang tiap X menit. Plus agenda/to-do list yang bisa dikelola AI.

const NATA_HOME_DIR = path.join(process.env.HOME || process.cwd(), '.nata');
const ALARMS_FILE = path.join(NATA_HOME_DIR, 'alarms.json');
const TODOS_FILE  = path.join(NATA_HOME_DIR, 'todos.json');
const _alarmTimers = new Map(); // id -> setTimeout handle

// Checker drift waktu akibat macOS sleep (tiap 15 detik)
setInterval(() => {
  try {
    const alarms = readJsonFile(ALARMS_FILE, []);
    const now = Date.now();
    for (const a of alarms) {
      if (a.atMs <= now && !_alarmTimers.has(a.id + '_fired')) {
        _alarmTimers.set(a.id + '_fired', true);
        fireAlarm(a.id).catch(() => {});
      }
    }
  } catch {}
}, 15000);

function readJsonFile(f, fallback) {
  try { const d = JSON.parse(fs.readFileSync(f, 'utf-8')); return Array.isArray(d) ? d : fallback; }
  catch { return fallback; }
}
function writeJsonFile(f, data) {
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, JSON.stringify(data, null, 2), 'utf-8');
}
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const fmtWaktu = (ms) => new Date(ms).toLocaleString('id-ID', { weekday: 'short', hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' });

async function notify({ title = 'Nata IDE', message = '' }, _ctx) {
  const { default: notifier } = await import('node-notifier');
  notifier.notify({ title, message, sound: true });
  return `🔔 Notifikasi dikirim: "${message}"`;
}

function armAlarm(a) {
  const delay = a.atMs - Date.now();
  if (delay <= 0 || delay > 2147000000) return false; // lewat, atau >24 hari (overflow setTimeout)
  const t = setTimeout(() => fireAlarm(a.id), delay);
  _alarmTimers.set(a.id, t);
  return true;
}

async function fireAlarm(id) {
  _alarmTimers.delete(id);
  const alarms = readJsonFile(ALARMS_FILE, []);
  const a = alarms.find(x => x.id === id);
  if (!a) return;
  try {
    const { default: notifier } = await import('node-notifier');
    notifier.notify({ title: '⏰ Alarm', message: a.message, sound: true });
  } catch {}
  if (a.repeatMs) {
    // Berulang → jadwalkan kejadian berikutnya (loncat ke masa depan kalau ketiduran)
    while (a.atMs <= Date.now()) a.atMs += a.repeatMs;
    writeJsonFile(ALARMS_FILE, alarms);
    armAlarm(a);
  } else {
    writeJsonFile(ALARMS_FILE, alarms.filter(x => x.id !== id));
  }
}

// alarm: {message, minutes|seconds} ATAU {message, at:"HH:MM"} + opsional
// {daily:true} / {every_minutes:N} untuk berulang.
async function alarm({ message = 'Waktunya!', seconds, minutes, at, daily, every_minutes }, _ctx) {
  let atMs = 0;
  let repeatMs = null;
  if (daily === true || daily === 'true') repeatMs = 86400000;
  const everyMin = Number(every_minutes) || 0;
  if (!repeatMs && everyMin >= 1) repeatMs = everyMin * 60000;

  if (at && /^\d{1,2}[:.]\d{2}$/.test(String(at).trim())) {
    // Jam absolut "15:00" → kejadian berikutnya (hari ini kalau belum lewat, besok kalau sudah)
    const [h, m] = String(at).trim().split(/[:.]/).map(Number);
    const d = new Date(); d.setHours(h, m, 0, 0);
    if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1);
    atMs = d.getTime();
  } else {
    let delaySec = Number(seconds) || 0;
    if (!delaySec && minutes) delaySec = Number(minutes) * 60;
    if (!delaySec && repeatMs) delaySec = repeatMs / 1000; // cuma kasih every_minutes → mulai satu interval lagi
    if (!delaySec || delaySec < 1) throw new Error('Butuh "minutes"/"seconds", atau "at" format "HH:MM".');
    atMs = Date.now() + delaySec * 1000;
  }

  const a = { id: newId(), message: String(message), atMs, repeatMs, createdAt: Date.now() };
  const alarms = readJsonFile(ALARMS_FILE, []);
  alarms.push(a);
  writeJsonFile(ALARMS_FILE, alarms);
  armAlarm(a);

  const ulang = repeatMs === 86400000 ? ' (🔁 tiap hari)' : repeatMs ? ` (🔁 tiap ${Math.round(repeatMs / 60000)} menit)` : '';
  return `⏰ Alarm diset: "${a.message}" → ${fmtWaktu(atMs)}${ulang} [id: ${a.id}]`;
}

async function list_alarms(_args, _ctx) {
  const alarms = readJsonFile(ALARMS_FILE, []).filter(a => a.atMs > Date.now() || a.repeatMs);
  if (!alarms.length) return '📭 Tidak ada alarm aktif.';
  return '⏰ Alarm aktif:\n\n' + alarms.map(a => {
    const ulang = a.repeatMs === 86400000 ? ' 🔁 tiap hari' : a.repeatMs ? ` 🔁 tiap ${Math.round(a.repeatMs / 60000)}m` : '';
    return `- [${a.id}] "${a.message}" → ${fmtWaktu(a.atMs)}${ulang}`;
  }).join('\n');
}

async function cancel_alarm({ id, message }, _ctx) {
  const alarms = readJsonFile(ALARMS_FILE, []);
  const target = alarms.find(a => (id && a.id === String(id).trim()) || (message && a.message.toLowerCase().includes(String(message).toLowerCase())));
  if (!target) throw new Error('Alarm tidak ketemu. Pakai list_alarms buat lihat id-nya.');
  clearTimeout(_alarmTimers.get(target.id));
  _alarmTimers.delete(target.id);
  writeJsonFile(ALARMS_FILE, alarms.filter(a => a.id !== target.id));
  return `🗑️ Alarm dibatalkan: "${target.message}"`;
}

// --- AGENDA / TO-DO (ala Cowork — AI bisa nambah, nyentang, hapus) ----------

async function todo_add({ text }, _ctx) {
  if (!text || !String(text).trim()) throw new Error('Butuh "text".');
  const todos = readJsonFile(TODOS_FILE, []);
  todos.push({ id: newId(), text: String(text).trim(), done: false, createdAt: Date.now() });
  writeJsonFile(TODOS_FILE, todos);
  return `📋 Ditambah ke agenda: "${String(text).trim()}"`;
}

async function todo_done({ id, text }, _ctx) {
  const todos = readJsonFile(TODOS_FILE, []);
  const t = todos.find(x => (id && x.id === String(id).trim()) || (text && x.text.toLowerCase().includes(String(text).toLowerCase())));
  if (!t) throw new Error('Tugas tidak ketemu di agenda.');
  t.done = !t.done;
  writeJsonFile(TODOS_FILE, todos);
  return t.done ? `✅ Kelar: "${t.text}"` : `⬜ Dibuka lagi: "${t.text}"`;
}

async function todo_delete({ id, text }, _ctx) {
  const todos = readJsonFile(TODOS_FILE, []);
  const t = todos.find(x => (id && x.id === String(id).trim()) || (text && x.text.toLowerCase().includes(String(text).toLowerCase())));
  if (!t) throw new Error('Tugas tidak ketemu di agenda.');
  writeJsonFile(TODOS_FILE, todos.filter(x => x.id !== t.id));
  return `🗑️ Dihapus dari agenda: "${t.text}"`;
}

async function todo_list(_args, _ctx) {
  const todos = readJsonFile(TODOS_FILE, []);
  if (!todos.length) return '📭 Agenda kosong.';
  const open = todos.filter(t => !t.done), done = todos.filter(t => t.done);
  return `📋 Agenda (${open.length} belum kelar):\n\n` +
    todos.map(t => `- [${t.done ? 'x' : ' '}] ${t.text} [id: ${t.id}]`).join('\n');
}

// Dipanggil dari main.js saat app start: arm ulang alarm yang masih di masa depan,
// buang yang sudah kelewat (non-repeat), majuin yang repeat ke kejadian berikutnya.
export function loadAlarms() {
  const alarms = readJsonFile(ALARMS_FILE, []);
  const keep = [];
  for (const a of alarms) {
    if (a.repeatMs) { while (a.atMs <= Date.now()) a.atMs += a.repeatMs; keep.push(a); armAlarm(a); }
    else if (a.atMs > Date.now()) { keep.push(a); armAlarm(a); }
    // non-repeat yang kelewat pas app mati → dibuang diam-diam
  }
  writeJsonFile(ALARMS_FILE, keep);
  return keep.length;
}

// Dipanggil pas app mau quit biar timer ga nyangkut (data alarm TETAP di file,
// nanti di-arm ulang oleh loadAlarms saat app dibuka lagi).
export function clearAlarms() {
  for (const t of _alarmTimers.values()) clearTimeout(t);
  _alarmTimers.clear();
}

// --- GENERATE IMAGE (Stable Diffusion, subprocess Python) ----------------
// Sebelum generate: Gemma di-unload dulu biar RAM lega.
// Setelah script Python keluar, model SD keluar dari RAM otomatis.

const OLLAMA_BIN_AG = ['/opt/homebrew/bin/ollama', '/usr/local/bin/ollama']
  .find(p => { try { return fs.existsSync(p); } catch { return false; } }) || 'ollama';
const OLLAMA_MODEL_AG = 'qwen3:4b-instruct';
const VENV_PY = path.join(__dirname, 'python-agent', 'venv', 'bin', 'python');
const IMAGE_GEN_SCRIPT = path.join(__dirname, 'python-agent', 'tools', 'image_gen.py');

async function generate_image({
  prompt, filename = 'generated.png',
  steps = 15, width = 512, height = 512, seed = -1, negative = '',
  model = 'runwayml/stable-diffusion-v1-5'
}, ctx) {
  if (!prompt) throw new Error('Butuh "prompt".');

  // Pastiin venv Python ada
  const pyExec = fs.existsSync(VENV_PY) ? VENV_PY : 'python3';

  // Dynamic import child_process (aman di Electron 20 + 31)
  const { spawn, spawnSync } = await import('child_process');

  // Cek diffusers tersedia sebelum mulai
  const check = spawnSync(pyExec, ['-c', 'import diffusers, torch'], { timeout: 8000 });
  if (check.status !== 0) {
    throw new Error(
      'diffusers / torch belum terinstall. Jalanin dulu:\n' +
      'cd python-agent && bash setup_image_gen.sh'
    );
  }

  // Unload Gemma dulu biar RAM lega (~2.9GB balik)
  if (ctx.onProgress) ctx.onProgress('♻️  Membebaskan RAM (unload Gemma)...');
  spawnSync(OLLAMA_BIN_AG, ['stop', OLLAMA_MODEL_AG], { timeout: 5000 });

  const out = resolveOut(ensureExt(filename, '.png'), ctx.cwd, 'Gambar');

  const spawnArgs = [
    IMAGE_GEN_SCRIPT,
    '--prompt',   prompt,
    '--output',   out,
    '--steps',    String(Math.min(steps,  30)),
    '--width',    String(Math.min(width,  768)),
    '--height',   String(Math.min(height, 768)),
    '--seed',     String(seed),
    '--model',    model,
  ];
  if (negative) spawnArgs.push('--negative', negative);

  return new Promise((resolve, reject) => {
    const child = spawn(pyExec, spawnArgs, { stdio: ['ignore', 'pipe', 'pipe'] });
    _activeChild = child;

    child.stdout.on('data', (data) => {
      const lines = data.toString().split('\n').filter(Boolean);
      for (const line of lines) {
        if (!ctx.onProgress) continue;
        if (line.startsWith('PROGRESS:')) {
          const [cur, tot] = line.replace('PROGRESS:', '').split('/');
          ctx.onProgress(`🎨 Step ${cur}/${tot}`);
        } else if (line.startsWith('STATUS:device:')) {
          const dev = line.includes('mps') ? 'Apple Silicon GPU (MPS)' : 'CPU';
          ctx.onProgress(`⚡ Pakai ${dev}`);
        } else if (line.startsWith('STATUS:loading:')) {
          ctx.onProgress('📦 Loading model (pertama kali ~2 menit + download ~1.7GB)...');
        } else if (line.startsWith('STATUS:generating')) {
          ctx.onProgress('🎨 Generating...');
        } else if (line.startsWith('ERROR:torch_missing')) {
          ctx.onProgress('❌ torch belum terinstall.');
        } else if (line.startsWith('ERROR:diffusers_missing')) {
          ctx.onProgress('❌ diffusers belum terinstall.');
        }
      }
    });

    let stderr = '';
    child.stderr.on('data', d => { stderr += d.toString(); });

    child.on('close', (code) => {
      _activeChild = null;
      if (code === 0)   return resolve(`✅ Gambar dibuat: ${out}`);
      if (code === null) return resolve('⚠️ Generate dibatalkan.');
      reject(new Error(
        stderr.trim().slice(-600) || `Proses keluar dengan kode ${code}`
      ));
    });

    child.on('error', (e) => { _activeChild = null; reject(e); });
  });
}

// --- ANALISA GAMBAR/VIDEO (opencv via venv) & BUKA BROWSER -----------------

const PY_DIRS = [path.join(__dirname, 'python-agent'), path.join(process.cwd(), 'python-agent')];
function venvPy() {
  const d = PY_DIRS.find(d => { try { return fs.existsSync(path.join(d, 'venv', 'bin', 'python')); } catch { return false; } });
  return d ? { py: path.join(d, 'venv', 'bin', 'python'), dir: d } : null;
}
async function runVision(args, timeout = 90000) {
  const v = venvPy();
  if (!v) throw new Error('Python venv belum ada (python-agent/venv).');
  const { spawnSync } = await import('child_process');
  const r = spawnSync(v.py, [path.join(v.dir, 'tools', 'vision.py'), ...args], { timeout });
  const m = (r.stdout || '').toString().match(/RESULT:(.*)/);
  if (!m) throw new Error(((r.stderr || '').toString().trim().slice(-200)) || 'analisa gagal');
  return JSON.parse(m[1]);
}

async function analyze_image({ input }, ctx) {
  if (!input) throw new Error('Butuh "input" (path gambar).');
  const src = resolveIn(input, ctx.cwd);
  const d = await runVision(['--image', src]);
  return `🖼 Analisa ${path.basename(src)}: ${d.lebar}×${d.tinggi}px · kecerahan ${d.kecerahan}/255 · ketajaman ${d.ketajaman} (di bawah ~100 = blur) · warna dominan ${[...new Set(d.warna_dominan)].join(' ')} · wajah terdeteksi: ${d.wajah_terdeteksi}`;
}

async function video_frames({ input, frames = 6 }, ctx) {
  if (!input) throw new Error('Butuh "input" (path video).');
  const src = resolveIn(input, ctx.cwd);
  const outdir = resolveOut('Frames', ctx.cwd);
  const d = await runVision(['--video', src, '--frames', String(Math.min(Number(frames) || 6, 20)), '--outdir', outdir], 180000);
  return `🎞 Video ${path.basename(src)}: ${d.durasi_detik}s · ${d.fps} fps · ${d.total_frame} frame. ${d.frame_tersimpan.length} frame diekstrak ke folder Frames/ — bisa dianalisa satu-satu pakai analyze_image.`;
}

async function open_url({ url }, _ctx) {
  if (!url || !/^https?:\/\//i.test(url)) throw new Error('Butuh "url" lengkap (https://...).');
  const { spawn } = await import('child_process');
  spawn('open', [url], { stdio: 'ignore' });
  return `🌐 Dibuka di browser: ${url}`;
}

// --- REGISTRY ------------------------------------------------------------

// --- CODING & WORKSPACE TOOLS --------------------------------------------

async function read_file({ path: p }, ctx) {
  if (!p) throw new Error('Butuh argumen "path".');
  const target = resolveIn(p, ctx.cwd);
  const content = fs.readFileSync(target, 'utf-8');
  return content;
}

async function write_file({ path: p, content = '' }, ctx) {
  if (!p) throw new Error('Butuh argumen "path".');
  if (!content || content.trim() === '') {
    throw new Error('Konten file kosong! Harap sertakan konten atau kode lengkap untuk ditulis ke dalam file.');
  }
  const target = resolveOut(p, ctx.cwd);
  fs.writeFileSync(target, content, 'utf-8');
  return `✅ Berkas berhasil ditulis ke: ${p}`;
}

async function edit_file({ path: p, search, replace }, ctx) {
  if (!p) throw new Error('Butuh argumen "path".');
  if (search === undefined || replace === undefined) throw new Error('Butuh argumen "search" dan "replace".');
  const target = resolveIn(p, ctx.cwd);
  let content = fs.readFileSync(target, 'utf-8');
  let mode = 'persis';
  if (content.includes(search)) {
    content = content.replace(search, replace);
  } else {
    // Fallback TOLERAN: model kecil sering meleset spasi/indentasi di SEARCH.
    // Cocokkan urutan baris (di-trim, baris kosong diabaikan), lalu ganti blok
    // aslinya — indentasi baris pertama dipertahankan.
    const sLines = search.split('\n').map(l => l.trim()).filter(l => l.length);
    if (!sLines.length) throw new Error('SEARCH kosong.');
    const lines = content.split('\n');
    const cl = lines.map((l, i) => ({ t: l.trim(), i })).filter(x => x.t.length);
    let hit = null;
    for (let i = 0; i + sLines.length <= cl.length; i++) {
      let ok = true;
      for (let j = 0; j < sLines.length; j++) {
        if (cl[i + j].t !== sLines[j]) { ok = false; break; }
      }
      if (ok) { hit = { start: cl[i].i, end: cl[i + sLines.length - 1].i }; break; }
    }
    if (!hit) {
      throw new Error(`Teks SEARCH tidak ditemukan di ${p} (dicoba juga pencocokan toleran spasi). Baca ulang file-nya pakai bash lalu salin teks PERSIS seperti aslinya.`);
    }
    const indent = (lines[hit.start].match(/^\s*/) || [''])[0];
    const repLines = replace.split('\n').map((l, k) => (k === 0 && !/^\s/.test(l) && l.trim().length) ? indent + l : l);
    lines.splice(hit.start, hit.end - hit.start + 1, ...repLines);
    content = lines.join('\n');
    mode = 'toleran-spasi';
  }
  fs.writeFileSync(target, content, 'utf-8');
  return `✅ Berkas ${p} berhasil diubah (search/replace ${mode}).`;
}

async function create_file({ path: p }, ctx) {
  if (!p) throw new Error('Butuh argumen "path".');
  const target = resolveOut(p, ctx.cwd);
  if (fs.existsSync(target)) return `⚠️ Berkas sudah ada: ${p}`;
  fs.writeFileSync(target, '', 'utf-8');
  return `✅ Berkas kosong berhasil dibuat di: ${p}`;
}

async function delete_file({ path: p }, ctx) {
  if (!p) throw new Error('Butuh argumen "path".');
  const target = resolveIn(p, ctx.cwd);
  fs.rmSync(target, { recursive: true, force: true });
  return `✅ Berkas/folder ${p} berhasil dihapus.`;
}

async function list_directory({ path: p }, ctx) {
  const target = p ? resolveIn(p, ctx.cwd) : (ctx.cwd || process.cwd());
  const entries = fs.readdirSync(target);
  return `📁 Isi folder ${p || '.'}:\n\n${entries.join('\n')}`;
}

async function rename_file({ oldPath, newPath }, ctx) {
  if (!oldPath || !newPath) throw new Error('Butuh argumen "oldPath" dan "newPath".');
  const src = resolveIn(oldPath, ctx.cwd);
  const dest = resolveOut(newPath, ctx.cwd);
  fs.renameSync(src, dest);
  return `✅ Berkas diubah namanya dari ${oldPath} menjadi ${newPath}`;
}

async function run_terminal({ command }, ctx) {
  if (!command) throw new Error('Butuh argumen "command".');
  const { spawn } = await import('child_process');
  
  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    
    const shell = process.env.SHELL || '/bin/zsh';
    const effectiveCwd = ctx.cwd || process.cwd();
    
    // Gunakan login shell agar PATH, Homebrew, nvm, dll. ter-load secara otomatis
    const child = spawn(shell, ['-l', '-c', command], {
      cwd: effectiveCwd,
      env: {
        ...process.env,
        FORCE_COLOR: '1',
        PATH: `/opt/homebrew/bin:/usr/local/bin:${effectiveCwd}/node_modules/.bin:${process.env.PATH || ''}`
      }
    });
    
    _activeChild = child;
    
    child.stdout.on('data', (data) => {
      const text = data.toString();
      stdout += text;
      // Kirim real-time output ke UI agar tidak terkesan freeze
      if (ctx.onProgress) {
        ctx.onProgress(text.trim().slice(-80));
      }
    });
    
    child.stderr.on('data', (data) => {
      const text = data.toString();
      stderr += text;
      if (ctx.onProgress) {
        ctx.onProgress(`⚠️ ${text.trim().slice(-80)}`);
      }
    });
    
    // Batas waktu pengaman 10 menit
    const timeoutTimer = setTimeout(() => {
      if (_activeChild === child) {
        child.kill('SIGTERM');
        _activeChild = null;
      }
    }, 600000);
    
    child.on('close', (code) => {
      clearTimeout(timeoutTimer);
      _activeChild = null;

      // Buang noise startup shell (.zprofile/.zshrc error) — noise ini pernah bikin
      // model panik karena SEMUA output keliatan error padahal command-nya sukses.
      const stripNoise = (s) => s.split('\n')
        .filter(l => !/^\/Users\/[^:]*\/\.(zprofile|zshrc|zshenv|zlogin|zlogout):\d+:/.test(l))
        .join('\n');
      const cleanOut = stripNoise(stdout).trim();
      const cleanErr = stripNoise(stderr).trim();
      
      if (code === 0) {
        resolve(`💻 Output terminal:\n\n${cleanOut || '(tidak ada output)'}`);
      } else if (code === null) {
        resolve(`⚠️ Perintah dibatalkan oleh pengguna.\n\nOutput sebelum batal:\n${cleanOut}`);
      } else {
        // Lemparkan error agar res.success bernilai false di ChatAgent.jsx
        reject(new Error(`Error terminal (exit code ${code}):\n\n${cleanOut}\n${cleanErr}`));
      }
    });

    child.on('error', (err) => {
      clearTimeout(timeoutTimer);
      _activeChild = null;
      reject(new Error(`Gagal menjalankan perintah: ${err.message}`));
    });
  });
}

async function search_files({ query }, ctx) {
  if (!query) throw new Error('Butuh argumen "query".');
  const root = ctx.cwd || process.cwd();
  const SKIP = new Set(['node_modules', '.git', 'dist', 'dist-electron', '.next', 'build', 'out', '.cache', '.turbo', 'coverage', '.venv', '__pycache__']);
  const results = [];
  const walk = (dir) => {
    if (results.length >= 50) return;
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (results.length >= 50) break;
      if (e.name.startsWith('.') && e.name !== '.env') { if (SKIP.has(e.name)) continue; }
      const full = path.join(dir, e.name);
      if (e.isDirectory()) { if (!SKIP.has(e.name)) walk(full); }
      else {
        if (/\.(jsx?|tsx?|py|go|rs|c|cpp|h|cs|java|php|html?|css|scss|json|ya?ml|md|txt|sh|env)$/i.test(e.name)) {
          try {
            const content = fs.readFileSync(full, 'utf-8');
            if (content.includes(query)) {
              results.push(path.relative(root, full));
            }
          } catch {}
        }
      }
    }
  };
  walk(root);
  return results.length > 0 
    ? `🔍 Ditemukan kata "${query}" di file berikut:\n\n${results.join('\n')}`
    : `🔍 Kata "${query}" tidak ditemukan di file mana pun.`;
}

// --- LEARNING HUB TOOLS ---
async function learning_hub_get(_args, _ctx) {
  const data = await getHubData();
  return JSON.stringify(data);
}

async function learning_hub_fetch(_args, _ctx) {
  const res = await fetchMaterials();
  return res;
}

async function learning_hub_learn_item({ id, modelHost, modelName }, _ctx) {
  const res = await learnItem({ id, modelHost, modelName });
  return JSON.stringify(res);
}

async function learning_hub_add_item({ title, content, url }, _ctx) {
  const res = await addCustomItem({ title, content, url });
  return res;
}

async function learning_hub_get_recent_lessons(_args, _ctx) {
  const lessons = await getRecentLessons();
  return lessons || 'Belum ada pelajaran yang tercatat.';
}

const TOOLS = {
  learning_hub_get,
  learning_hub_fetch,
  learning_hub_learn_item,
  learning_hub_add_item,
  learning_hub_get_recent_lessons,
  create_word, create_pdf, create_pptx,
  image_resize, image_convert, image_ocr,
  generate_image,
  analyze_image, video_frames, open_url,
  scrape,
  notify, alarm, list_alarms, cancel_alarm,
  todo_add, todo_done, todo_delete, todo_list,
  // Workspace coding tools
  readFile: read_file,
  writeFile: write_file,
  editFile: edit_file,
  createFile: create_file,
  deleteFile: delete_file,
  listDirectory: list_directory,
  renameFile: rename_file,
  runTerminal: run_terminal,
  searchFiles: search_files,
};

// Dipanggil dari IPC. Selalu balikin { success, message }.
export async function runTool(name, args = {}, ctx = {}) {
  const fn = TOOLS[name];
  if (!fn) return { success: false, message: `Tool '${name}' nggak ada.` };
  try {
    const message = await fn(args, ctx);
    return { success: true, message };
  } catch (err) {
    return { success: false, message: `Error pas jalanin ${name}: ${err.message}` };
  }
}
