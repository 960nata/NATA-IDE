import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Image as ImageIcon, FileText, Globe, Bell, TerminalSquare, FolderOpen, RefreshCw, Trash2, Play, Sparkles, Save, Clock, Send } from 'lucide-react';
import { toast } from '../toast';

// ModeWorkspace — panel HASIL di sisi kiri untuk mode non-programmer.
// Chat (sisi kanan) yang nyuruh AI kerja; panel ini nampilin hasilnya live
// lewat event 'nata-tool-ran' + isi folder workspace mode tsb.

const IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'];
const DOC_EXTS = ['docx', 'pdf', 'pptx', 'md', 'txt', 'doc', 'csv'];
const ext = (p) => (p || '').split('.').pop().toLowerCase();

// Kirim prompt ke chat tab aktif di sebelah kanan
const askAI = (prompt) => window.dispatchEvent(new CustomEvent('nata-chat-prompt', { detail: prompt }));

// ── style helpers (samain vibe sama IDE) ────────────────────────────────────
const S = {
  panel: { flex: 1, minWidth: 0, height: '100%', display: 'flex', flexDirection: 'column', background: '#0b0d12', overflow: 'hidden' },
  header: { display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', borderBottom: '1px solid var(--border-color)', background: '#0f1118', flexShrink: 0 },
  body: { flex: 1, overflowY: 'auto', padding: '16px' },
  card: { background: '#11141c', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '10px', padding: '14px' },
  btn: { display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(77,159,255,0.1)', border: '1px solid rgba(77,159,255,0.3)', borderRadius: '7px', color: '#4d9fff', fontSize: '12px', fontWeight: 600, padding: '6px 12px', cursor: 'pointer' },
  btnGhost: { display: 'inline-flex', alignItems: 'center', gap: '5px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '7px', color: '#9aa4b2', fontSize: '11.5px', padding: '5px 10px', cursor: 'pointer' },
  input: { background: '#0d0e13', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '7px', color: '#e3e3e6', fontSize: '12.5px', padding: '8px 10px', outline: 'none' },
  muted: { fontSize: '12px', color: '#6b7280' },
  mono: { fontFamily: '"JetBrains Mono", monospace' },
};

// ── hook: daftar file workspace (auto-refresh saat AI kerja / folder berubah) ─
function useWorkspaceFiles(root, exts) {
  const [files, setFiles] = useState([]);
  const refresh = useCallback(async () => {
    if (!root) return;
    try {
      const r = await window.electronAPI.listFiles(root);
      const all = (r?.files || []).filter(f => exts.includes(ext(f.name)));
      setFiles(all);
    } catch {}
  }, [root, exts.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    refresh();
    let t;
    const bump = () => { clearTimeout(t); t = setTimeout(refresh, 400); };
    window.addEventListener('nata-tool-ran', bump);
    const offWatch = window.electronAPI.onWorkspaceChanged ? window.electronAPI.onWorkspaceChanged(bump) : null;
    return () => { clearTimeout(t); window.removeEventListener('nata-tool-ran', bump); offWatch && offWatch(); };
  }, [refresh]);
  return [files, refresh];
}

// ── hook: feed hasil per mode (persist di sessionStorage, se-umur app) ───────
function useModeFeed(mode, cap = 30) {
  const key = `nata_mode_feed_${mode}`;
  const [feed, setFeed] = useState(() => {
    try { const s = JSON.parse(sessionStorage.getItem(key) || '[]'); if (Array.isArray(s)) return s; } catch {}
    return [];
  });
  const push = useCallback((item) => {
    setFeed(prev => {
      const next = [{ id: Date.now() + Math.random(), ts: Date.now(), ...item }, ...prev].slice(0, cap);
      try { sessionStorage.setItem(key, JSON.stringify(next)); } catch {}
      return next;
    });
  }, [key, cap]);
  const clear = useCallback(() => { setFeed([]); try { sessionStorage.removeItem(key); } catch {} }, [key]);
  return [feed, push, clear];
}

const fmtTime = (ts) => new Date(ts).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

// ── header umum tiap mode ────────────────────────────────────────────────────
function PanelHeader({ icon, title, subtitle, currentPath, onRefresh, extra }) {
  return (
    <div style={S.header}>
      <div style={{ width: 34, height: 34, borderRadius: 9, background: '#11161f', border: '1px solid rgba(77,159,255,.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#4d9fff' }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '14px', fontWeight: 700, color: '#eef2f8' }}>{title}</div>
        <div style={{ ...S.muted, ...S.mono, fontSize: '10.5px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={currentPath}>
          {subtitle || (currentPath || '').replace(/^\/Users\/[^/]+/, '~')}
        </div>
      </div>
      {extra}
      {currentPath && (
        <button style={S.btnGhost} title="Tampilkan folder di Finder" onClick={() => window.electronAPI.revealPath(currentPath)}>
          <FolderOpen size={13} /> Folder
        </button>
      )}
      {onRefresh && (
        <button style={S.btnGhost} title="Segarkan" onClick={onRefresh}><RefreshCw size={13} /></button>
      )}
    </div>
  );
}

function EmptyState({ emoji, title, note, chips }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '48px 24px', textAlign: 'center' }}>
      <div style={{ fontSize: '40px' }}>{emoji}</div>
      <div style={{ fontSize: '15px', fontWeight: 700, color: '#e3e3e6' }}>{title}</div>
      <div style={{ ...S.muted, maxWidth: '380px', lineHeight: 1.6 }}>{note}</div>
      {chips?.length > 0 && (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center', marginTop: '8px' }}>
          {chips.map(c => (
            <button key={c.label} style={S.btn} onClick={() => askAI(c.prompt)}><Sparkles size={12} /> {c.label}</button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── thumbnail gambar (base64 via IPC) ───────────────────────────────────────
function Thumb({ path, style }) {
  const [src, setSrc] = useState(null);
  useEffect(() => {
    let dead = false;
    window.electronAPI.readImage(path).then(r => { if (!dead && r?.success) setSrc(r.dataUrl); });
    return () => { dead = true; };
  }, [path]);
  if (!src) return <div style={{ ...style, background: '#161a23', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3a4150' }}><ImageIcon size={18} /></div>;
  return <img src={src} alt="" style={{ ...style, objectFit: 'cover' }} />;
}

// ═════════════════════ 02 · STUDIO GAMBAR ═══════════════════════════════════
function ImagePanel({ currentPath }) {
  const [files, refresh] = useWorkspaceFiles(currentPath, IMAGE_EXTS);
  const [selected, setSelected] = useState(null); // file obj
  useEffect(() => { if (selected && !files.some(f => f.path === selected.path)) setSelected(null); }, [files]); // eslint-disable-line

  const actions = selected ? [
    { label: 'Resize 800px', prompt: `Resize gambar ${selected.rel} jadi lebar 800px` },
    { label: '→ WebP', prompt: `Konversi gambar ${selected.rel} ke format webp` },
    { label: '→ PNG', prompt: `Konversi gambar ${selected.rel} ke format png` },
    { label: 'OCR (baca teks)', prompt: `Baca teks dari gambar ${selected.rel} pakai OCR` },
  ] : [];

  return (
    <div style={S.panel}>
      <PanelHeader icon={<ImageIcon size={17} />} title="Studio Gambar" currentPath={currentPath} onRefresh={refresh}
        extra={<span style={{ ...S.muted, ...S.mono, fontSize: '11px', marginRight: '4px' }}>{files.length} gambar</span>} />
      <div style={S.body}>
        {selected && (
          <div style={{ ...S.card, marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <Thumb path={selected.path} style={{ width: '100%', maxHeight: '300px', borderRadius: '8px', objectFit: 'contain', background: '#0d0e13' }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
              <span style={{ ...S.mono, fontSize: '12px', color: '#cbd5e1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selected.rel}</span>
              <button style={S.btnGhost} onClick={() => window.electronAPI.revealPath(selected.path)}><FolderOpen size={12} /></button>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {actions.map(a => (
                <button key={a.label} style={S.btn} onClick={() => { askAI(a.prompt); toast('Dikirim ke AI →', 'info'); }}>
                  <Sparkles size={12} /> {a.label}
                </button>
              ))}
            </div>
          </div>
        )}
        {files.length === 0 ? (
          <EmptyState emoji="🖼️" title="Belum ada gambar"
            note="Taruh gambar ke folder workspace ini (klik tombol Folder di atas), atau suruh AI generate gambar baru. Hasil resize/konversi/OCR bakal muncul di sini."
            chips={[
              { label: 'Generate gambar AI', prompt: 'Generate gambar pemandangan gunung saat senja, gaya digital art, simpan sebagai senja.png' },
            ]} />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '10px' }}>
            {files.map(f => (
              <div key={f.path} onClick={() => setSelected(f)} title={f.rel}
                style={{ cursor: 'pointer', borderRadius: '9px', overflow: 'hidden', border: selected?.path === f.path ? '2px solid #4d9fff' : '1px solid rgba(255,255,255,0.08)', background: '#11141c' }}>
                <Thumb path={f.path} style={{ width: '100%', height: '96px', display: 'block' }} />
                <div style={{ padding: '6px 8px', fontSize: '10.5px', color: '#9aa4b2', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', ...S.mono }}>{f.name}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ═════════════════════ 04 · GENERATOR DOKUMEN ════════════════════════════════
const DOC_ICON = { docx: '📝', doc: '📝', pdf: '📕', pptx: '📊', md: '🗒️', txt: '🗒️', csv: '📈' };
function DocsPanel({ currentPath }) {
  const [files, refresh] = useWorkspaceFiles(currentPath, DOC_EXTS);
  return (
    <div style={S.panel}>
      <PanelHeader icon={<FileText size={17} />} title="Generator Dokumen" currentPath={currentPath} onRefresh={refresh}
        extra={<span style={{ ...S.muted, ...S.mono, fontSize: '11px', marginRight: '4px' }}>{files.length} dokumen</span>} />
      <div style={S.body}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
          {[
            { label: '+ Word', prompt: 'Aku mau bikin dokumen Word. Tanyakan dulu ke aku: judulnya apa dan isinya poin-poin apa saja. Setelah aku jawab, baru buat dokumennya.' },
            { label: '+ PDF', prompt: 'Aku mau bikin PDF. Tanyakan dulu ke aku: judulnya apa dan isinya apa saja. Setelah aku jawab, baru buat PDF-nya.' },
            { label: '+ PowerPoint', prompt: 'Aku mau bikin presentasi PowerPoint. Tanyakan dulu ke aku: topiknya apa dan berapa slide. Setelah aku jawab, baru buat slide-nya.' },
          ].map(c => (
            <button key={c.label} style={S.btn} onClick={() => askAI(c.prompt)}>{c.label}</button>
          ))}
        </div>
        {files.length === 0 ? (
          <EmptyState emoji="📄" title="Belum ada dokumen"
            note='Minta AI di chat kanan, contoh: "Buatkan PDF laporan penjualan bulan Juni berisi 3 paragraf ringkasan". Hasilnya otomatis muncul di daftar ini.'
            chips={[
              { label: 'Contoh: PDF Laporan', prompt: 'Buatkan PDF judul "Laporan Mingguan" berisi ringkasan kegiatan minggu ini (karang isinya yang masuk akal, 4 paragraf)' },
              { label: 'Contoh: Slide 3 halaman', prompt: 'Buatkan presentasi PowerPoint 3 slide tentang manfaat AI lokal untuk produktivitas' },
            ]} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {files.map(f => (
              <div key={f.path} style={{ ...S.card, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '22px', flexShrink: 0 }}>{DOC_ICON[ext(f.name)] || '📄'}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#e3e3e6', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.name}</div>
                  <div style={{ ...S.muted, ...S.mono, fontSize: '10.5px' }}>{f.rel}</div>
                </div>
                <button style={S.btnGhost} title="Tampilkan di Finder" onClick={() => window.electronAPI.revealPath(f.path)}><FolderOpen size={13} /> Buka</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ═════════════════════ 03 · WEB SCRAPER ═════════════════════════════════════
function ScrapePanel({ currentPath }) {
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [feed, push, clear] = useModeFeed('scrape', 15);

  // Hasil scrape yang dikerjain AI dari chat ikut masuk feed
  useEffect(() => {
    const h = (e) => {
      const d = e.detail;
      if (d?.name === 'scrape' && d.success) push({ url: d.args?.url || '?', text: d.message, via: 'AI' });
    };
    window.addEventListener('nata-tool-ran', h);
    return () => window.removeEventListener('nata-tool-ran', h);
  }, [push]);

  const doScrape = async () => {
    const u = url.trim();
    if (!u || busy) return;
    const full = /^https?:\/\//i.test(u) ? u : 'https://' + u;
    setBusy(true);
    try {
      const res = await window.electronAPI.runTool('scrape', { url: full }, currentPath);
      if (res.success) { push({ url: full, text: res.message, via: 'manual' }); setUrl(''); }
      else toast(res.message || 'Scrape gagal', 'error');
    } catch (e) { toast(e.message, 'error'); }
    setBusy(false);
  };

  const saveMd = async (item) => {
    const fname = `Scrape/scrape-${new Date(item.ts).toISOString().slice(0, 16).replace(/[:T]/g, '-')}.md`;
    const md = `# Hasil scrape\n\nURL: ${item.url}\nWaktu: ${new Date(item.ts).toLocaleString('id-ID')}\n\n---\n\n${item.text}\n`;
    const r = await window.electronAPI.runTool('writeFile', { path: fname, content: md }, currentPath);
    toast(r.success ? `Tersimpan: ${fname}` : r.message, r.success ? 'success' : 'error');
  };

  return (
    <div style={S.panel}>
      <PanelHeader icon={<Globe size={17} />} title="Web Scraper" currentPath={currentPath}
        extra={feed.length > 0 && <button style={S.btnGhost} title="Bersihkan hasil" onClick={clear}><Trash2 size={13} /></button>} />
      <div style={{ display: 'flex', gap: '8px', padding: '12px 16px', borderBottom: '1px solid var(--border-color)', flexShrink: 0 }}>
        <input value={url} onChange={e => setUrl(e.target.value)} onKeyDown={e => e.key === 'Enter' && doScrape()}
          placeholder="https://situs-yang-mau-diambil.com" style={{ ...S.input, ...S.mono, flex: 1 }} spellCheck={false} />
        <button style={{ ...S.btn, opacity: busy ? 0.6 : 1 }} disabled={busy} onClick={doScrape}>
          <Play size={12} /> {busy ? 'Ngambil...' : 'Scrape'}
        </button>
        <button style={S.btn} disabled={!url.trim()} title="Scrape lalu langsung dirangkum AI"
          onClick={() => { const u = url.trim(); if (u) { askAI(`Scrape lalu rangkum isi halaman ini dalam bahasa Indonesia yang rapi: ${/^https?:\/\//i.test(u) ? u : 'https://' + u}`); setUrl(''); } }}>
          <Sparkles size={12} /> + Rangkum AI
        </button>
      </div>
      <div style={S.body}>
        {feed.length === 0 ? (
          <EmptyState emoji="🌐" title="Belum ada hasil scrape"
            note="Masukin URL di atas terus klik Scrape (hasil mentah) atau + Rangkum AI (langsung dirangkum di chat kanan). Hasil scrape dari perintah chat juga muncul di sini." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {feed.map(item => (
              <div key={item.id} style={S.card}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#4d9fff', ...S.mono, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.url}>{item.url}</span>
                  <span style={{ ...S.muted, fontSize: '10.5px', flexShrink: 0 }}>{item.via === 'AI' ? '🤖 via AI' : '⚡ manual'} · {fmtTime(item.ts)}</span>
                </div>
                <div className="sel" style={{ maxHeight: '180px', overflowY: 'auto', fontSize: '12px', lineHeight: 1.65, color: '#b7c0cc', whiteSpace: 'pre-wrap', background: '#0d0e13', borderRadius: '7px', padding: '10px 12px' }}>
                  {(item.text || '').slice(0, 4000)}
                </div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                  <button style={S.btn} onClick={() => askAI(`Rangkum hasil scrape ini dalam bahasa Indonesia singkat, poin-poin penting saja:\n\n${(item.text || '').slice(0, 5000)}`)}>
                    <Sparkles size={12} /> Rangkum AI
                  </button>
                  <button style={S.btnGhost} onClick={() => saveMd(item)}><Save size={12} /> Simpan .md</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ═════════════════════ 05 · ALARM & NOTIFIKASI ══════════════════════════════
function Countdown({ endTs }) {
  const [, force] = useState(0);
  useEffect(() => { const t = setInterval(() => force(x => x + 1), 1000); return () => clearInterval(t); }, []);
  const left = Math.max(0, Math.round((endTs - Date.now()) / 1000));
  if (left <= 0) return <span style={{ color: '#2fe08a', fontWeight: 700 }}>🔔 bunyi!</span>;
  const m = Math.floor(left / 60), s = left % 60;
  return <span style={{ ...S.mono, color: '#4d9fff', fontWeight: 700, fontSize: '15px' }}>{m}:{String(s).padStart(2, '0')}</span>;
}

function AlarmPanel({ currentPath }) {
  // Sumber data = file persist ~/.nata/alarms.json & todos.json (ditulis main process).
  // Panel ini cuma VIEW + tombol yang manggil tool yang sama kayak yang dipakai AI —
  // jadi alarm/agenda dari chat, dari form, dan setelah restart SELALU sinkron.
  const [msg, setMsg] = useState('');
  const [mins, setMins] = useState('');
  const [jam, setJam] = useState('');       // "HH:MM" opsional
  const [harian, setHarian] = useState(false);
  const [todoText, setTodoText] = useState('');
  const [alarms, setAlarms] = useState([]);
  const [todos, setTodos] = useState([]);
  const [history, pushHistory] = useModeFeed('alarm', 20);
  const homeRef = useRef('');

  const refresh = useCallback(async () => {
    try {
      if (!homeRef.current) homeRef.current = (await window.electronAPI.getSystemInfo())?.home || '';
      const home = homeRef.current;
      if (!home) return;
      const [ra, rt] = await Promise.all([
        window.electronAPI.readFile(`${home}/.nata/alarms.json`).catch(() => null),
        window.electronAPI.readFile(`${home}/.nata/todos.json`).catch(() => null),
      ]);
      try { setAlarms(ra?.success ? JSON.parse(ra.content) : []); } catch { setAlarms([]); }
      try { setTodos(rt?.success ? JSON.parse(rt.content) : []); } catch { setTodos([]); }
    } catch {}
  }, []);

  useEffect(() => {
    refresh();
    const iv = setInterval(refresh, 10000); // alarm bunyi/repeat digeser main process → sync berkala
    let t;
    const h = (e) => {
      const d = e.detail;
      if (d?.name === 'notify' && d.success) pushHistory({ kind: 'notify', title: d.args?.title || 'Nata IDE', message: d.args?.message || '' });
      clearTimeout(t); t = setTimeout(refresh, 400);
    };
    window.addEventListener('nata-tool-ran', h);
    return () => { clearInterval(iv); clearTimeout(t); window.removeEventListener('nata-tool-ran', h); };
  }, [refresh, pushHistory]);

  const runTool = async (name, args, okMsg) => {
    const res = await window.electronAPI.runTool(name, args, currentPath);
    toast(res.success ? (okMsg || res.message) : res.message, res.success ? 'success' : 'error');
    refresh();
    return res;
  };

  const setAlarmSubmit = async () => {
    const args = { message: msg.trim() || 'Waktunya!' };
    if (/^\d{1,2}[:.]\d{2}$/.test(jam.trim())) args.at = jam.trim();
    else if (Number(mins) > 0) args.minutes = Number(mins);
    else { toast('Isi menit ATAU jam (mis. 15:00) dulu ya', 'error'); return; }
    if (harian) args.daily = true;
    const res = await runTool('alarm', args);
    if (res.success) { setMsg(''); setMins(''); setJam(''); setHarian(false); }
  };

  const addTodo = async () => {
    const text = todoText.trim();
    if (!text) return;
    setTodoText('');
    await runTool('todo_add', { text }, `Masuk agenda: ${text}`);
  };

  const activeAlarms = alarms.filter(a => a.atMs > Date.now() || a.repeatMs);
  const openTodos = todos.filter(t => !t.done), doneTodos = todos.filter(t => t.done);

  return (
    <div style={S.panel}>
      <PanelHeader icon={<Bell size={17} />} title="Alarm & Agenda" currentPath={currentPath}
        subtitle="Sekretaris lokal — alarm persist + agenda, sinkron sama AI"
        extra={<button style={S.btnGhost} onClick={() => runTool('notify', { title: 'Nata IDE', message: 'Notifikasi jalan! 🎉' }, 'Notifikasi terkirim')}><Bell size={12} /> Tes notif</button>} />
      <div style={S.body}>
        {/* Form set alarm */}
        <div style={{ ...S.card, marginBottom: '16px' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: '#cbd5e1', marginBottom: '10px' }}>⏰ Set alarm baru</div>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
            <input value={msg} onChange={e => setMsg(e.target.value)} placeholder="Pesan pengingat (mis. Meeting sore)" style={{ ...S.input, flex: 1 }}
              onKeyDown={e => e.key === 'Enter' && setAlarmSubmit()} />
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <input value={mins} onChange={e => { setMins(e.target.value.replace(/[^\d]/g, '')); setJam(''); }} placeholder="menit" style={{ ...S.input, width: '64px', textAlign: 'center' }} />
            <span style={S.muted}>atau jam</span>
            <input value={jam} onChange={e => { setJam(e.target.value); setMins(''); }} placeholder="15:00" style={{ ...S.input, ...S.mono, width: '70px', textAlign: 'center' }} />
            <button onClick={() => setHarian(v => !v)} style={{ ...S.btnGhost, color: harian ? '#2fe08a' : '#9aa4b2', borderColor: harian ? 'rgba(47,224,138,0.4)' : 'rgba(255,255,255,0.1)' }}>
              🔁 Tiap hari {harian ? 'ON' : 'OFF'}
            </button>
            <button style={S.btn} onClick={setAlarmSubmit}><Clock size={12} /> Set</button>
          </div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}>
            {[5, 10, 25, 60].map(m => (
              <button key={m} style={S.btnGhost} onClick={() => runTool('alarm', { minutes: m, message: msg.trim() || `Alarm ${m} menit` })}>{m}m</button>
            ))}
          </div>
        </div>

        {/* Alarm aktif — dari file persist, survive restart */}
        <div style={{ fontSize: '12px', fontWeight: 700, color: '#cbd5e1', margin: '4px 0 10px' }}>⏰ Alarm aktif ({activeAlarms.length}) <span style={{ ...S.muted, fontWeight: 400 }}>— tetap hidup walau app di-restart</span></div>
        {activeAlarms.length === 0 ? (
          <div style={{ ...S.muted, marginBottom: '18px' }}>Belum ada. Set di atas, atau ketik di chat kanan: "ingetin aku tiap pagi jam 7 buat olahraga"</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '18px' }}>
            {activeAlarms.map(a => (
              <div key={a.id} style={{ ...S.card, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Countdown endTs={a.atMs} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', color: '#e3e3e6', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.message}</div>
                  <div style={{ ...S.muted, fontSize: '10.5px' }}>
                    bunyi {new Date(a.atMs).toLocaleString('id-ID', { weekday: 'short', hour: '2-digit', minute: '2-digit' })}
                    {a.repeatMs === 86400000 ? ' · 🔁 tiap hari' : a.repeatMs ? ` · 🔁 tiap ${Math.round(a.repeatMs / 60000)}m` : ''}
                  </div>
                </div>
                <button style={S.btnGhost} title="Batalkan alarm" onClick={() => runTool('cancel_alarm', { id: a.id }, 'Alarm dibatalkan')}><Trash2 size={12} /></button>
              </div>
            ))}
          </div>
        )}

        {/* Agenda / to-do ala Cowork — AI & kamu ngelola daftar yang sama */}
        <div style={{ fontSize: '12px', fontWeight: 700, color: '#cbd5e1', margin: '4px 0 10px' }}>📋 Agenda ({openTodos.length} belum kelar)</div>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
          <input value={todoText} onChange={e => setTodoText(e.target.value)} placeholder="Tambah tugas… (Enter)" style={{ ...S.input, flex: 1 }}
            onKeyDown={e => e.key === 'Enter' && addTodo()} />
          <button style={S.btn} onClick={addTodo}>+ Tambah</button>
        </div>
        {todos.length === 0 ? (
          <div style={{ ...S.muted, marginBottom: '18px' }}>Agenda kosong. Tambah di atas, atau bilang ke AI: "catat agendaku: bales email, beli kopi"</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '18px' }}>
            {[...openTodos, ...doneTodos].map(t => (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 10px', background: '#11141c', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px' }}>
                <button onClick={() => runTool('todo_done', { id: t.id }, t.done ? 'Dibuka lagi' : 'Kelar ✓')}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '15px', padding: 0, flexShrink: 0 }}>
                  {t.done ? '✅' : '⬜'}
                </button>
                <span style={{ flex: 1, fontSize: '13px', color: t.done ? '#6b7280' : '#e3e3e6', textDecoration: t.done ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.text}</span>
                <button style={{ ...S.btnGhost, padding: '3px 7px' }} title="Hapus" onClick={() => runTool('todo_delete', { id: t.id }, 'Dihapus dari agenda')}><Trash2 size={11} /></button>
              </div>
            ))}
          </div>
        )}

        {/* Riwayat notifikasi */}
        {history.length > 0 && (
          <>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#cbd5e1', margin: '4px 0 10px' }}>Riwayat notifikasi</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {history.map(h => (
                <div key={h.id} style={{ display: 'flex', gap: '10px', fontSize: '12px', color: '#9aa4b2' }}>
                  <span style={{ ...S.muted, ...S.mono, fontSize: '10.5px', flexShrink: 0 }}>{fmtTime(h.ts)}</span>
                  <span>🔔 {h.title}: {h.message}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ═════════════════════ 06 · TERMINAL AI ═════════════════════════════════════
function TerminalPanel({ currentPath }) {
  const [cmd, setCmd] = useState('');
  const [busy, setBusy] = useState(false);
  const [feed, push, clear] = useModeFeed('terminal', 40);
  const bodyRef = useRef(null);

  // Perintah yang dijalanin AI dari chat ikut tampil di konsol
  useEffect(() => {
    const h = (e) => {
      const d = e.detail;
      if (d?.name === 'runTerminal') push({ command: d.args?.command || '?', output: d.message, via: 'AI', success: d.success });
    };
    window.addEventListener('nata-tool-ran', h);
    return () => window.removeEventListener('nata-tool-ran', h);
  }, [push]);

  useEffect(() => { if (bodyRef.current) bodyRef.current.scrollTop = 0; }, [feed.length]);

  const run = async () => {
    const c = cmd.trim();
    if (!c || busy) return;
    setBusy(true);
    setCmd('');
    try {
      const res = await window.electronAPI.runTool('runTerminal', { command: c }, currentPath);
      push({ command: c, output: res.message, via: 'manual', success: res.success });
    } catch (e) {
      push({ command: c, output: e.message, via: 'manual', success: false });
    }
    setBusy(false);
  };

  return (
    <div style={S.panel}>
      <PanelHeader icon={<TerminalSquare size={17} />} title="Terminal AI" currentPath={currentPath}
        subtitle="Konsol — output perintah dari kamu & dari AI"
        extra={feed.length > 0 && <button style={S.btnGhost} onClick={clear}><Trash2 size={13} /></button>} />
      <div ref={bodyRef} style={{ ...S.body, ...S.mono, fontSize: '12px' }}>
        {feed.length === 0 ? (
          <EmptyState emoji="💻" title="Konsol masih kosong"
            note='Ketik perintah di bawah (mis. "ls -la"), atau tanya AI di chat kanan — perintah yang dia jalanin bakal muncul di sini lengkap sama output-nya.'
            chips={[
              { label: 'Cek info sistem', prompt: 'Tampilkan info sistem Mac ini (OS, chip, RAM, disk) lalu jelaskan singkat' },
              { label: 'Proses boros RAM', prompt: 'Cek 5 proses paling banyak makan RAM sekarang dan jelaskan' },
            ]} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {feed.map(item => (
              <div key={item.id} style={{ ...S.card, padding: '10px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <span style={{ color: '#2fe08a' }}>$</span>
                  <span style={{ color: '#e3e3e6', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.command}>{item.command}</span>
                  <span style={{ ...S.muted, fontSize: '10px', flexShrink: 0 }}>{item.via === 'AI' ? '🤖' : '👤'} {fmtTime(item.ts)}</span>
                </div>
                <pre className="sel" style={{ margin: 0, maxHeight: '200px', overflowY: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: '11.5px', lineHeight: 1.6, color: item.success === false ? '#fca5a5' : '#9fb2c9', background: '#0d0e13', borderRadius: '6px', padding: '8px 10px' }}>
                  {(item.output || '(tidak ada output)').slice(0, 4000)}
                </pre>
              </div>
            ))}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: '8px', padding: '10px 16px', borderTop: '1px solid var(--border-color)', flexShrink: 0, alignItems: 'center' }}>
        <span style={{ ...S.mono, color: '#2fe08a', fontSize: '13px' }}>$</span>
        <input value={cmd} onChange={e => setCmd(e.target.value)} onKeyDown={e => e.key === 'Enter' && run()}
          placeholder={busy ? 'Menjalankan...' : 'ketik perintah shell… (Enter)'} disabled={busy}
          style={{ ...S.input, ...S.mono, flex: 1 }} spellCheck={false} />
        <button style={{ ...S.btn, opacity: busy ? 0.6 : 1 }} disabled={busy} onClick={run}><Send size={12} /> Run</button>
      </div>
    </div>
  );
}

// ── router per mode ──────────────────────────────────────────────────────────
export default function ModeWorkspace({ mode, currentPath }) {
  switch (mode) {
    case 'image':    return <ImagePanel currentPath={currentPath} />;
    case 'docs':     return <DocsPanel currentPath={currentPath} />;
    case 'scrape':   return <ScrapePanel currentPath={currentPath} />;
    case 'alarm':    return <AlarmPanel currentPath={currentPath} />;
    case 'terminal': return <TerminalPanel currentPath={currentPath} />;
    default:
      return (
        <div style={S.panel}>
          <div style={S.body}><EmptyState emoji="🚧" title="Mode belum dikenal" note={`Mode "${mode}" belum punya panel hasil.`} /></div>
        </div>
      );
  }
}
