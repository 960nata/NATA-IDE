import React, { useState, useEffect, useCallback, useRef } from 'react';
import FileExplorer from './components/FileExplorer';
import CodeEditor from './components/CodeEditor';
import ChatAgent from './components/ChatAgent';
import BottomPanel from './components/BottomPanel';
import EditorTabs from './components/EditorTabs';
import LandingScreen, { MODES } from './components/LandingScreen';
import ImagePreview from './components/ImagePreview';
import ActivityBar from './components/ActivityBar';
import ProgrammerWelcome, { pushRecentWorkspace } from './components/ProgrammerWelcome';
import ModeWorkspace from './components/ModeWorkspace';
import { SearchPanel, SourceControlPanel, PlaceholderPanel, SkillsPanel } from './components/SidebarPanels';
import { ArrowLeft, Cpu, Plus, X, GitBranch, Sparkles, Bell } from 'lucide-react';
import { toast } from './toast';
import KeyboardShortcutsModal from './components/KeyboardShortcutsModal';
import NotificationCenter from './components/NotificationCenter';
import OnboardingTour from './components/OnboardingTour';

const IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'];
const isImageFile = (p) => p && IMAGE_EXTS.includes(p.split('.').pop().toLowerCase());
const newChatId = () => `chat_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

// Bar tipis buat geser lebar panel. dir: 'left' kalau panel ada di kanan (chat),
// 'right' kalau panel di kiri (sidebar). onResize dikasih lebar baru (px).
function Resizer({ onResize, side = 'right' }) {
  const drag = (e) => {
    e.preventDefault();
    // Delta HARUS inkremental (dari posisi terakhir) — dulu dihitung dari titik awal
    // lalu ditambah terus ke width tiap mousemove → panel "lari" kelebihan.
    let lastX = e.clientX;
    const move = (ev) => {
      const delta = ev.clientX - lastX;
      lastX = ev.clientX;
      onResize(side === 'left' ? -delta : delta); // chat (kanan): geser kiri = lebih lebar
    };
    const up = () => {
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
  };
  return (
    <div
      onMouseDown={drag}
      style={{ width: '5px', flexShrink: 0, cursor: 'col-resize', background: 'transparent', height: '100%', position: 'relative', zIndex: 5 }}
      onMouseEnter={e => e.currentTarget.style.background = 'rgba(96,165,250,0.4)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      title="Geser buat ubah lebar"
    />
  );
}

// Command Palette — Cmd+K / Cmd+Shift+P. actions: [{label, hint, run}]
function CommandPalette({ open, onClose, actions }) {
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const inputRef = React.useRef(null);
  React.useEffect(() => { if (open) { setQ(''); setSel(0); setTimeout(() => inputRef.current?.focus(), 0); } }, [open]);
  if (!open) return null;
  const filtered = actions.filter(a => a.label.toLowerCase().includes(q.toLowerCase()));
  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel(s => Math.min(s + 1, filtered.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel(s => Math.max(s - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); filtered[sel]?.run(); onClose(); }
    else if (e.key === 'Escape') onClose();
  };
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,0.4)', display: 'flex', justifyContent: 'center', paddingTop: '12vh' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '540px', maxWidth: '90vw', height: 'fit-content', maxHeight: '60vh', background: '#1d1d22', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '10px', boxShadow: '0 16px 48px rgba(0,0,0,0.6)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <input ref={inputRef} value={q} onChange={e => { setQ(e.target.value); setSel(0); }} onKeyDown={onKey}
          placeholder="Ketik perintah... (↑↓ pilih, Enter jalankan, Esc tutup)"
          style={{ background: 'transparent', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.08)', outline: 'none', color: '#e3e3e6', fontSize: '14px', padding: '14px 16px' }} />
        <div style={{ overflowY: 'auto' }}>
          {filtered.length === 0 && <div style={{ padding: '14px 16px', color: '#6b7280', fontSize: '13px' }}>Tidak ada perintah</div>}
          {filtered.map((a, i) => (
            <div key={a.label} onClick={() => { a.run(); onClose(); }} onMouseEnter={() => setSel(i)}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 16px', cursor: 'pointer', background: i === sel ? 'rgba(96,165,250,0.15)' : 'transparent', color: i === sel ? '#fff' : '#cbd5e1', fontSize: '13px' }}>
              <span>{a.label}</span>
              {a.hint && <span style={{ fontSize: '11px', color: '#6b7280' }}>{a.hint}</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Settings modal — atur model, autocomplete, tema, update feed (semua via localStorage)
function SettingsModal({ open, onClose }) {
  const [model, setModel] = useState(localStorage.getItem('nata_model') || 'qwen3:4b-instruct');
  const [autocomplete, setAutocomplete] = useState(localStorage.getItem('nata_autocomplete') !== 'off');
  const [theme, setTheme] = useState(localStorage.getItem('nata_editor_theme') || 'vs-dark');
  const [feed, setFeed] = useState(localStorage.getItem('nata_update_feed') || '');
  const [formatOnSave, setFormatOnSave] = useState(localStorage.getItem('nata_format_on_save') === 'on');
  const [minimap, setMinimap] = useState(localStorage.getItem('nata_minimap') !== 'off');
  const [stickyScroll, setStickyScroll] = useState(localStorage.getItem('nata_sticky_scroll') !== 'off');
  const [gitBlame, setGitBlame] = useState(localStorage.getItem('nata_git_blame') !== 'off');

  React.useEffect(() => { if (open) {
    setModel(localStorage.getItem('nata_model') || 'qwen3:4b-instruct');
    setAutocomplete(localStorage.getItem('nata_autocomplete') !== 'off');
    setTheme(localStorage.getItem('nata_editor_theme') || 'vs-dark');
    setFeed(localStorage.getItem('nata_update_feed') || '');
    setFormatOnSave(localStorage.getItem('nata_format_on_save') === 'on');
    setMinimap(localStorage.getItem('nata_minimap') !== 'off');
    setStickyScroll(localStorage.getItem('nata_sticky_scroll') !== 'off');
    setGitBlame(localStorage.getItem('nata_git_blame') !== 'off');
  } }, [open]);
  if (!open) return null;
  const save = () => {
    localStorage.setItem('nata_model', model.trim());
    localStorage.setItem('nata_autocomplete', autocomplete ? 'on' : 'off');
    localStorage.setItem('nata_editor_theme', theme);
    localStorage.setItem('nata_update_feed', feed.trim());
    localStorage.setItem('nata_format_on_save', formatOnSave ? 'on' : 'off');
    localStorage.setItem('nata_minimap', minimap ? 'on' : 'off');
    localStorage.setItem('nata_sticky_scroll', stickyScroll ? 'on' : 'off');
    localStorage.setItem('nata_git_blame', gitBlame ? 'on' : 'off');
    onClose(true);
  };
  const row = { display: 'flex', flexDirection: 'column', gap: '5px', marginBottom: '16px' };
  const lbl = { fontSize: '12px', fontWeight: 700, color: '#cbd5e1' };
  const inp = { background: '#0d0e13', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#e3e3e6', fontSize: '13px', padding: '8px 10px', outline: 'none', fontFamily: '"JetBrains Mono", monospace' };
  return (
    <div onClick={() => onClose(false)} style={{ position: 'fixed', inset: 0, zIndex: 3000, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', paddingTop: '10vh' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '480px', maxWidth: '90vw', height: 'fit-content', background: '#1d1d22', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '12px', padding: '22px', boxShadow: '0 16px 48px rgba(0,0,0,0.6)' }}>
        <h3 style={{ margin: '0 0 18px', fontSize: '15px', color: '#e3e3e6' }}>⚙️ Pengaturan</h3>
        <div style={row}>
          <span style={lbl}>Model AI (Ollama)</span>
          <input value={model} onChange={e => setModel(e.target.value)} style={inp} placeholder="qwen3:4b-instruct" />
          <span style={{ fontSize: '11px', color: '#6b7280' }}>Dipakai buat chat, autocomplete, inline edit. Harus udah di-pull di Ollama.</span>
        </div>
        <div style={row}>
          <span style={lbl}>Tema Editor</span>
          <select value={theme} onChange={e => setTheme(e.target.value)} style={inp}>
            <option value="vs-dark">Dark</option>
            <option value="light">Light</option>
            <option value="hc-black">High Contrast</option>
          </select>
        </div>
        <div style={{ ...row, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <span style={lbl}>Tab-Autocomplete AI</span>
          <button onClick={() => setAutocomplete(v => !v)} style={{ ...inp, cursor: 'pointer', color: autocomplete ? '#34d399' : '#6b7280', fontWeight: 700, padding: '4px 10px' }}>{autocomplete ? 'ON' : 'OFF'}</button>
        </div>
        <div style={{ ...row, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <span style={lbl}>Format on Save</span>
          <button onClick={() => setFormatOnSave(v => !v)} style={{ ...inp, cursor: 'pointer', color: formatOnSave ? '#34d399' : '#6b7280', fontWeight: 700, padding: '4px 10px' }}>{formatOnSave ? 'ON' : 'OFF'}</button>
        </div>
        <div style={{ ...row, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <span style={lbl}>Tampilkan Minimap</span>
          <button onClick={() => setMinimap(v => !v)} style={{ ...inp, cursor: 'pointer', color: minimap ? '#34d399' : '#6b7280', fontWeight: 700, padding: '4px 10px' }}>{minimap ? 'ON' : 'OFF'}</button>
        </div>
        <div style={{ ...row, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <span style={lbl}>Sticky Scroll</span>
          <button onClick={() => setStickyScroll(v => !v)} style={{ ...inp, cursor: 'pointer', color: stickyScroll ? '#34d399' : '#6b7280', fontWeight: 700, padding: '4px 10px' }}>{stickyScroll ? 'ON' : 'OFF'}</button>
        </div>
        <div style={{ ...row, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <span style={lbl}>Inline Git Blame</span>
          <button onClick={() => setGitBlame(v => !v)} style={{ ...inp, cursor: 'pointer', color: gitBlame ? '#34d399' : '#6b7280', fontWeight: 700, padding: '4px 10px' }}>{gitBlame ? 'ON' : 'OFF'}</button>
        </div>
        <div style={row}>
          <span style={lbl}>URL Update Feed (opsional)</span>
          <input value={feed} onChange={e => setFeed(e.target.value)} style={inp} placeholder="https://.../version.json" />
        </div>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '8px' }}>
          <button onClick={() => onClose(false)} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '6px', color: '#cbd5e1', padding: '8px 16px', fontSize: '13px', cursor: 'pointer' }}>Batal</button>
          <button onClick={save} style={{ background: 'linear-gradient(135deg, var(--accent-gemma), var(--accent-cyan))', border: 'none', borderRadius: '6px', color: '#050508', padding: '8px 16px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>Simpan</button>
        </div>
      </div>
    </div>
  );
}

// Toast host — dengerin event 'nata-toast', tampilin stack notif yg auto-hilang
function ToastHost() {
  const [toasts, setToasts] = useState([]);
  useEffect(() => {
    const h = (e) => {
      const t = e.detail;
      setToasts(p => [...p, t]);
      setTimeout(() => setToasts(p => p.filter(x => x.id !== t.id)), 3500);
    };
    window.addEventListener('nata-toast', h);
    return () => window.removeEventListener('nata-toast', h);
  }, []);
  const color = { success: '#34d399', error: '#f87171', info: '#60a5fa' };
  return (
    <div style={{ position: 'fixed', bottom: '20px', right: '20px', zIndex: 5000, display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
      {toasts.map(t => (
        <div key={t.id} style={{
          background: '#1d1d22', border: `1px solid ${color[t.type] || color.info}55`, borderLeft: `3px solid ${color[t.type] || color.info}`,
          borderRadius: '8px', padding: '10px 14px', color: '#e3e3e6', fontSize: '12.5px', maxWidth: '340px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)', animation: 'slideIn 0.2s ease',
        }}>{t.message}</div>
      ))}
      <style>{`@keyframes slideIn { from { transform: translateX(20px); opacity: 0; } to { transform: none; opacity: 1; } }`}</style>
    </div>
  );
}

// Quick Open — Cmd+P fuzzy cari file di workspace
function QuickOpen({ open, onClose, root, onOpenFile }) {
  const [q, setQ] = useState('');
  const [files, setFiles] = useState([]);
  const [sel, setSel] = useState(0);
  const inputRef = React.useRef(null);
  React.useEffect(() => {
    if (open) {
      setQ(''); setSel(0);
      setTimeout(() => inputRef.current?.focus(), 0);
      window.electronAPI.listFiles(root).then(r => setFiles(r.files || []));
    }
  }, [open, root]);
  if (!open) return null;
  const ql = q.toLowerCase();
  const filtered = (ql ? files.filter(f => f.rel.toLowerCase().includes(ql)) : files).slice(0, 200);
  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel(s => Math.min(s + 1, filtered.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel(s => Math.max(s - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (filtered[sel]) { onOpenFile(filtered[sel].path); onClose(); } }
    else if (e.key === 'Escape') onClose();
  };
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,0.4)', display: 'flex', justifyContent: 'center', paddingTop: '12vh' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '560px', maxWidth: '90vw', maxHeight: '60vh', background: '#1d1d22', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '10px', boxShadow: '0 16px 48px rgba(0,0,0,0.6)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <input ref={inputRef} value={q} onChange={e => { setQ(e.target.value); setSel(0); }} onKeyDown={onKey}
          placeholder={`Cari file... (${files.length} file)`}
          style={{ background: 'transparent', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.08)', outline: 'none', color: '#e3e3e6', fontSize: '14px', padding: '14px 16px', fontFamily: '"JetBrains Mono", monospace' }} />
        <div style={{ overflowY: 'auto' }}>
          {filtered.length === 0 && <div style={{ padding: '14px 16px', color: '#6b7280', fontSize: '13px' }}>Tidak ada file</div>}
          {filtered.map((f, i) => (
            <div key={f.path} onClick={() => { onOpenFile(f.path); onClose(); }} onMouseEnter={() => setSel(i)}
              style={{ display: 'flex', flexDirection: 'column', padding: '6px 16px', cursor: 'pointer', background: i === sel ? 'rgba(96,165,250,0.15)' : 'transparent' }}>
              <span style={{ fontSize: '13px', color: i === sel ? '#fff' : '#e3e3e6' }}>{f.name}</span>
              <span style={{ fontSize: '11px', color: '#6b7280', fontFamily: '"JetBrains Mono", monospace' }}>{f.rel}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Error boundary — biar 1 error gak bikin seluruh IDE gelap/blank
class ErrorBoundary extends React.Component {
  constructor(p) { super(p); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  componentDidCatch(err) { console.error('Nata IDE crash:', err); }
  render() {
    if (this.state.err) {
      return (
        <div style={{ padding: '40px', color: '#e3e3e6', fontFamily: 'system-ui', height: '100%', overflow: 'auto' }}>
          <h2 style={{ color: '#f87171' }}>⚠️ Ada error di UI</h2>
          <p style={{ color: '#9ca3af', fontSize: '13px' }}>IDE-nya gak crash total — klik reload buat balik.</p>
          <pre style={{ background: '#1d1d22', padding: '12px', borderRadius: '8px', fontSize: '12px', color: '#fca5a5', whiteSpace: 'pre-wrap' }}>{String(this.state.err?.stack || this.state.err)}</pre>
          <button onClick={() => { this.setState({ err: null }); location.reload(); }} style={{ marginTop: '12px', background: 'linear-gradient(135deg, var(--accent-gemma), var(--accent-cyan))', border: 'none', borderRadius: '6px', color: '#050508', padding: '10px 18px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>Reload</button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [mode, setMode] = useState(null);
  const [workspaceRoot, setWorkspaceRoot] = useState(null);
  const [activeView, setActiveView] = useState('explorer');
  const [currentPath, setCurrentPath] = useState('');

  // Multi-tab editor
  const [openTabs, setOpenTabs] = useState([]);   // [{ path, dirty }]
  const [activeTab, setActiveTab] = useState(null); // path | null

  // Global Status Bar states
  const [gitBranch, setGitBranch] = useState('');
  const [wordWrap, setWordWrap] = useState(() => localStorage.getItem('nata_word_wrap') !== 'off');
  const [bottomTab, setBottomTab] = useState('terminal');

  // Onboarding, Keyboard shortcuts reference, and Notification center
  const [showShortcutsRef, setShowShortcutsRef] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [showNotificationCenter, setShowNotificationCenter] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(() => localStorage.getItem('nata_onboarded') !== 'true');

  const handleReorderTabs = (fromIdx, toIdx) => {
    setOpenTabs(prev => {
      const copy = [...prev];
      const [removed] = copy.splice(fromIdx, 1);
      copy.splice(toIdx, 0, removed);
      return copy;
    });
  };

  // Fetch git status branch name
  useEffect(() => {
    const fetchBranch = async () => {
      const r = workspaceRoot || currentPath;
      if (!r) return;
      try {
        const res = await window.electronAPI.gitStatus(r);
        if (res && res.isRepo) {
          setGitBranch(res.branch || '');
        } else {
          setGitBranch('');
        }
      } catch (err) {
        setGitBranch('');
      }
    };
    fetchBranch();
    const interval = setInterval(fetchBranch, 7000);
    return () => clearInterval(interval);
  }, [workspaceRoot, currentPath]);

  // Mulai pantau filesystem workspace supaya FileExplorer bisa auto-refresh
  useEffect(() => {
    if (!workspaceRoot) return;
    window.electronAPI.watchWorkspace(workspaceRoot).catch(() => {/* silent */});
  }, [workspaceRoot]);

  useEffect(() => {
    const handleToast = (e) => {
      const { message, type } = e.detail;
      setNotifications(prev => [
        { id: Date.now(), message, type, time: new Date().toLocaleTimeString(), read: false },
        ...prev
      ]);
      setUnreadNotifications(u => u + 1);
    };
    window.addEventListener('nata-toast', handleToast);
    return () => window.removeEventListener('nata-toast', handleToast);
  }, []);

  const toggleNotificationCenter = () => {
    setShowNotificationCenter(prev => {
      const next = !prev;
      if (next) {
        setUnreadNotifications(0);
        setNotifications(p => p.map(n => ({ ...n, read: true })));
      }
      return next;
    });
  };

  // Lebar panel yang bisa digeser (persist). Clamp biar gak ketipisan/kelebaran.
  const [sidebarWidth, setSidebarWidth] = useState(() => +localStorage.getItem('nata_sidebar_w') || 250);
  const [chatWidth, setChatWidth]       = useState(() => +localStorage.getItem('nata_chat_w') || 420);
  const [editorReload, setEditorReload] = useState(0); // sinyal reload editor pas file diubah AI
  const [splitTab, setSplitTab] = useState(null); // file yg di-pin di panel kanan (split editor)
  const [zen, setZen] = useState(false); // sembunyiin sidebar + chat (fokus editor)
  const closedTabsRef = useRef([]); // stack file yg baru ditutup buat reopen
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [quickOpenShow, setQuickOpenShow] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  useEffect(() => {
    const h = (e) => {
      // Cmd+Shift+P / Cmd+K → command palette
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || (e.shiftKey && (e.key === 'p' || e.key === 'P')))) {
        e.preventDefault(); setPaletteOpen(v => !v); return;
      }
      // Cmd+P (tanpa shift) → quick open file
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault(); setQuickOpenShow(v => !v); return;
      }
      // Cmd+Shift+T → buka lagi tab yang baru ditutup
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 't' || e.key === 'T')) {
        e.preventDefault();
        const last = closedTabsRef.current.pop();
        if (last) handleOpenFile(last);
        return;
      }
      // Cmd+. → zen mode (sembunyiin panel samping)
      if ((e.metaKey || e.ctrlKey) && e.key === '.') {
        e.preventDefault(); setZen(v => !v);
      }
      // Alt+Z / Option+Z → toggle word wrap
      if (e.altKey && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        setWordWrap(w => {
          const next = !w;
          localStorage.setItem('nata_word_wrap', next ? 'on' : 'off');
          toast(`Word Wrap: ${next ? 'ON' : 'OFF'}`, 'info');
          return next;
        });
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const resizeSidebar = (d) => setSidebarWidth(w => { const n = clamp(w + d, 150, 600); localStorage.setItem('nata_sidebar_w', n); return n; });
  const resizeChat    = (d) => setChatWidth(w => { const n = clamp(w + d, 280, 800); localStorage.setItem('nata_chat_w', n); return n; });
  // Panel bawah (terminal/problems) bisa ditarik naik-turun
  const [bottomHeight, setBottomHeight] = useState(() => +localStorage.getItem('nata_bottom_h') || 220);
  const dragBottom = (e) => {
    e.preventDefault();
    let lastY = e.clientY;
    const mv = (ev) => {
      const d = lastY - ev.clientY;
      lastY = ev.clientY;
      setBottomHeight(h => { const n = clamp(h + d, 100, window.innerHeight - 180); localStorage.setItem('nata_bottom_h', n); return n; });
    };
    const up = () => { document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up); document.body.style.cursor = ''; document.body.style.userSelect = ''; };
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', mv);
    document.addEventListener('mouseup', up);
  };

  // Multi-tab chat — persist daftar tab & tab aktif (cuma ilang kalau user tutup).
  // TIAP MODE punya kunci storage sendiri → chat & riwayatnya beda-beda per mode.
  // Programmer tetap pakai kunci lama biar chat lama user gak ilang.
  const chatTabsKey   = (m) => (!m || m === 'programmer') ? 'nata_chat_tabs'   : `nata_chat_tabs_${m}`;
  const activeChatKey = (m) => (!m || m === 'programmer') ? 'nata_active_chat' : `nata_active_chat_${m}`;
  const loadChatTabs = (m) => {
    try {
      const saved = JSON.parse(localStorage.getItem(chatTabsKey(m)) || 'null');
      if (Array.isArray(saved) && saved.length) return saved;
    } catch {}
    return [{ id: newChatId(), label: 'Chat 1' }];
  };
  const [chatTabs, setChatTabs] = useState(() => loadChatTabs(null));
  const [activeChatId, setActiveChatId] = useState(() => {
    const saved = localStorage.getItem('nata_active_chat');
    return saved || (chatTabs[0] && chatTabs[0].id);
  });
  // Mode yang tab-nya lagi kepasang di state — guard biar pas ganti mode,
  // tab mode lama gak kesimpen ke kunci mode baru.
  const chatModeRef = useRef(null);
  useEffect(() => {
    const tabs = loadChatTabs(mode);
    const savedActive = localStorage.getItem(activeChatKey(mode));
    chatModeRef.current = mode;
    setChatTabs(tabs);
    setActiveChatId(tabs.some(t => t.id === savedActive) ? savedActive : tabs[0].id);
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(() => {
    if (chatModeRef.current !== mode) return;
    localStorage.setItem(chatTabsKey(mode), JSON.stringify(chatTabs));
  }, [chatTabs]); // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(() => {
    if (chatModeRef.current !== mode) return;
    if (activeChatId) localStorage.setItem(activeChatKey(mode), activeChatId);
  }, [activeChatId]); // eslint-disable-line react-hooks/exhaustive-deps
  // Self-heal: kalau activeChatId nyasar (tab udah ilang), balik ke tab pertama biar chat gak blank
  React.useEffect(() => {
    if (chatTabs.length && !chatTabs.some(t => t.id === activeChatId)) setActiveChatId(chatTabs[0].id);
  }, [chatTabs, activeChatId]);

  // Terminal / bottom panel
  const [terminalLogs, setTerminalLogs] = useState([]);
  const [isRunningCommand, setIsRunningCommand] = useState(false);
  const [activeProcessId, setActiveProcessId] = useState(null);
  const [sysUser, setSysUser] = useState('');
  const [sysHost, setSysHost] = useState('');
  // Diagnostics terpisah dari terminal — hanya code errors (eslint, tsc, dll)
  const [diagnostics, setDiagnostics] = useState([]); // [{file, line, col, type, message}]
  const [isCheckingDiagnostics, setIsCheckingDiagnostics] = useState(false);
  // Workspace mode Cowork — folder tempat AI kerja, bisa dipilih user, keinget.
  // HARUS di sini (atas semua early-return) — hooks di bawah return = layar gelap.
  const [coworkRoot, setCoworkRoot] = useState(() => localStorage.getItem('nata_cowork_root') || '');
  // Browser Preview di dalam IDE — auto kebuka pas dev server hidup
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewKey, setPreviewKey] = useState(0);
  useEffect(() => {
    const h = (e) => { if (e.detail) { setPreviewUrl(e.detail); setPreviewKey(k => k + 1); } };
    window.addEventListener('nata-preview', h);
    return () => window.removeEventListener('nata-preview', h);
  }, []);
  // Installed skills (dari filesystem) — di-share ke ChatAgent buat autocomplete
  const [installedSkills, setInstalledSkills] = useState([]);

  useEffect(() => {
    window.electronAPI.getSystemInfo().then(info => {
      setCurrentPath(info.cwd);
      setSysUser(info.username || '');
      setSysHost(info.hostname || '');
    }).catch(() => {});

    // Pemicu pembelajaran harian otonom pas start up
    const today = new Date().toISOString().split('T')[0];
    window.electronAPI.runTool('learning_hub_get', {}).then(res => {
      if (res.success && res.message) {
        const dbData = JSON.parse(res.message);
        if (dbData.stats.lastFetchedDate !== today) {
          // Tarik materi baru di background
          window.electronAPI.runTool('learning_hub_fetch', {}).then(() => {
            console.log('Daily learning hub fetch completed.');
          }).catch(err => console.error(err));
        }
      }
    }).catch(() => {});
  }, []);

  // ---- Tab editor helpers ------------------------------------------------

  const handleOpenFile = useCallback((filePath) => {
    setOpenTabs(prev => {
      if (prev.some(t => t.path === filePath)) return prev;
      return [...prev, { path: filePath, dirty: false }];
    });
    setActiveTab(filePath);
  }, []);

  const handleCloseTab = useCallback((filePath) => {
    closedTabsRef.current.push(filePath); // simpan buat reopen (Cmd+Shift+T)
    setOpenTabs(prev => {
      const next = prev.filter(t => t.path !== filePath);
      return next;
    });
    setActiveTab(prev => {
      if (prev !== filePath) return prev;
      const remaining = openTabs.filter(t => t.path !== filePath);
      return remaining.length ? remaining[remaining.length - 1].path : null;
    });
  }, [openTabs]);

  const handleFileSaved = useCallback((filePath) => {
    setOpenTabs(prev => prev.map(t => t.path === filePath ? { ...t, dirty: false } : t));
    setTerminalLogs(prev => [...prev, { type: 'system', text: `[System] Tersimpan: ${filePath}` }]);
    // Auto-diagnostics tiap save (debounce — nunggu user selesai nyimpen beruntun)
    clearTimeout(window.__nataDiagT);
    window.__nataDiagT = setTimeout(() => window.dispatchEvent(new CustomEvent('nata-run-diagnostics')), 1500);
  }, []);

  const handleFileDirty = useCallback((filePath, dirty) => {
    setOpenTabs(prev => prev.map(t => t.path === filePath ? { ...t, dirty } : t));
  }, []);

  // ---- Chat tab helpers --------------------------------------------------

  const addChatTab = () => {
    const id = newChatId();
    const label = `Chat ${chatTabs.length + 1}`;
    setChatTabs(prev => [...prev, { id, label }]);
    setActiveChatId(id);
  };

  const closeChatTab = (id) => {
    try { localStorage.removeItem(`nata_chat_msgs_${id}`); } catch {} // hapus riwayat tab yg ditutup
    if (chatTabs.length <= 1) {
      // Tab terakhir → reset jadi chat baru kosong (bukan dibiarin)
      const nid = newChatId();
      setChatTabs([{ id: nid, label: 'Chat 1' }]);
      setActiveChatId(nid);
      return;
    }
    // Hitung tab pengganti DULU (deterministik), baru update state — biar gak ada momen "active" nunjuk tab hilang
    const idx = chatTabs.findIndex(t => t.id === id);
    const next = chatTabs.filter(t => t.id !== id);
    if (activeChatId === id) {
      const fallback = next[Math.max(0, idx - 1)] || next[0];
      setActiveChatId(fallback.id);
    }
    setChatTabs(next);
  };

  // ---- Workspace --------------------------------------------------------

  // Masuk mode dari landing. Mode non-programmer otomatis dapat workspace sendiri
  // di ~/Nata/<Nama Mode> — hasil kerja AI (gambar/dokumen/scrape) kesimpen rapi di situ.
  const handleEnterMode = async (key) => {
    setMode(key);
    try {
      const info = await window.electronAPI.getSystemInfo();
      if (key === 'programmer') {
        setCurrentPath(info.cwd); // reset — jangan kebawa folder mode lain
        return;
      }
      const title = MODES.find(m => m.key === key)?.title || key;
      const dir = `${info.home}/Nata/${title}`;
      await window.electronAPI.makeDir(dir).catch(() => {});
      setWorkspaceRoot(dir);
      setCurrentPath(dir);
    } catch {}
  };

  const handleOpenFolder = (folderPath) => {
    setWorkspaceRoot(folderPath);
    setCurrentPath(folderPath);
    setOpenTabs([]);
    setActiveTab(null);
    setActiveView('explorer');
    pushRecentWorkspace(folderPath);
  };

  // ---- Run command -------------------------------------------------------

  const handleRunCommand = async (command) => {
    // Kalau ada proses lama (mis. dev server) masih jalan → matiin dulu, baru jalanin yg baru
    if (isRunningCommand && activeProcessId) {
      setTerminalLogs(prev => [...prev, { type: 'system', text: '[System] Menghentikan proses sebelumnya...' }]);
      await window.electronAPI.killCommand(activeProcessId).catch(() => {});
      setIsRunningCommand(false);
      setActiveProcessId(null);
      await new Promise(r => setTimeout(r, 300));
    }
    const processId = 'proc_' + Math.random().toString(36).slice(2) + Date.now();
    setActiveProcessId(processId);
    setIsRunningCommand(true);
    setTerminalLogs(prev => [...prev, { type: 'system', text: `\n$ ${command}` }]);

    const cOut   = window.electronAPI.onTerminalOut(processId, d => setTerminalLogs(p => [...p, { type: 'out', text: d }]));
    const cErr   = window.electronAPI.onTerminalErr(processId, d => setTerminalLogs(p => [...p, { type: 'err', text: d }]));
    const cClose = window.electronAPI.onTerminalClose(processId, code => {
      setTerminalLogs(p => [...p, { type: 'system', text: `[Keluar: ${code}]` }]);
      cOut(); cErr(); cClose();
      setIsRunningCommand(false);
      setActiveProcessId(null);
    });

    try {
      await window.electronAPI.executeCommand(command, currentPath, processId);
    } catch (err) {
      setTerminalLogs(p => [...p, { type: 'err', text: `[Error] ${err.message}` }]);
      cOut(); cErr(); cClose();
      setIsRunningCommand(false);
      setActiveProcessId(null);
    }
  };

  // Adopsi proses server yg udah dijalanin AI → biar TETAP HIDUP & keliatan di terminal,
  // bisa di-stop manual. Dipanggil pas AI sukses nyalain dev server (jangan dibunuh!).
  const adoptProcess = (processId, command, url) => {
    setActiveProcessId(processId);
    setIsRunningCommand(true);
    setTerminalLogs(prev => [
      ...prev,
      { type: 'system', text: `\n$ ${command}` },
      { type: 'system', text: `[AI] Server jalan & TETAP HIDUP${url ? ` → ${url}` : ''}. Klik ⏹ di terminal buat stop.` },
    ]);
    if (url) { setPreviewUrl(url); setPreviewKey(k => k + 1); } // auto-buka Browser Preview
    const cOut   = window.electronAPI.onTerminalOut(processId, d => setTerminalLogs(p => [...p, { type: 'out', text: d }]));
    const cErr   = window.electronAPI.onTerminalErr(processId, d => setTerminalLogs(p => [...p, { type: 'err', text: d }]));
    const cClose = window.electronAPI.onTerminalClose(processId, code => {
      setTerminalLogs(p => [...p, { type: 'system', text: `[Keluar: ${code}]` }]);
      cOut(); cErr(); cClose();
      setIsRunningCommand(false);
      setActiveProcessId(null);
    });
  };

  const handleKillCommand = async () => {
    if (activeProcessId) await window.electronAPI.killCommand(activeProcessId).catch(() => {});
  };

  // ---- Write file --------------------------------------------------------

  const handleWriteFile = async (filePath, content) => {
    const targetPath = filePath.startsWith('/') ? filePath : `${currentPath}/${filePath}`;
    try {
      const res = await window.electronAPI.writeFile(targetPath, content);
      if (res.success) {
        setTerminalLogs(prev => [...prev, { type: 'system', text: `[System] Tulis: ${targetPath}` }]);
        // JANGAN auto-buka tab / nyolong fokus — dulu tiap AI nulis file, editor
        // ketiban tab baru & ganggu user. File yang lagi kebuka cukup di-reload;
        // file baru cukup muncul di Explorer (klik sendiri kalau mau lihat).
        setEditorReload(n => n + 1); // sinyal reload editor (file diubah dari luar)
      } else {
        setTerminalLogs(prev => [...prev, { type: 'err', text: `[Error] ${res.error}` }]);
      }
    } catch (err) {
      setTerminalLogs(prev => [...prev, { type: 'err', text: `[Error] ${err.message}` }]);
    }
  };

  // ---- Diagnostics (Problems panel) — run eslint/tsc, bukan dari terminal logs
  // full=true (klik manual) → eslint + tsc; full=false (auto tiap save/agent) → tsc doang,
  // biar MacBook 8GB gak kepanasan gara-gara 2 proses node berat tiap save.
  const runDiagnostics = useCallback(async (root, full = false) => {
    const cwd = root || workspaceRoot || currentPath;
    if (!cwd || isCheckingDiagnostics) return;
    setIsCheckingDiagnostics(true);
    setDiagnostics([]);

    const runCapture = (cmd) => new Promise((resolve) => {
      const pid = 'diag_' + Math.random().toString(36).slice(2);
      let out = '';
      const cOut   = window.electronAPI.onTerminalOut(pid, d => { out += d; });
      const cErr   = window.electronAPI.onTerminalErr(pid, d => { out += d; });
      const cClose = window.electronAPI.onTerminalClose(pid, () => { cOut(); cErr(); cClose(); resolve(out); });
      setTimeout(() => { cOut(); cErr(); cClose(); resolve(out); }, 20000);
      window.electronAPI.executeCommand(cmd, cwd, pid).catch(() => resolve(out));
    });

    const results = [];

    // 1. ESLint — cuma pas full check (klik manual), berat buat auto-run
    try {
      const raw = full ? await runCapture('npx eslint . --ext .js,.jsx,.ts,.tsx --format json 2>/dev/null || npx eslint . --format json 2>/dev/null') : '[]';
      const json = JSON.parse(raw.trim().split('\n').find(l => l.trim().startsWith('[')) || '[]');
      for (const file of json) {
        for (const msg of (file.messages || [])) {
          results.push({
            file: file.filePath?.replace(cwd + '/', '') || '?',
            line: msg.line || 0,
            col: msg.column || 0,
            type: msg.severity === 2 ? 'error' : 'warning',
            message: msg.message,
            source: 'eslint',
          });
        }
      }
    } catch {}

    // 2. TypeScript (kalau ada tsconfig.json)
    try {
      const hasTsc = await runCapture('test -f tsconfig.json && echo yes');
      if (hasTsc.includes('yes')) {
        const raw = await runCapture('npx tsc --noEmit --incremental 2>&1'); // incremental = jauh lebih cepat & adem setelah run pertama
        for (const line of raw.split('\n')) {
          // Format: src/file.tsx(10,5): error TS2345: ...
          const m = line.match(/^(.+?)\((\d+),(\d+)\):\s*(error|warning)\s+TS\d+:\s*(.+)/);
          if (m) {
            results.push({
              file: m[1].replace(cwd + '/', ''),
              line: parseInt(m[2]),
              col: parseInt(m[3]),
              type: m[4],
              message: m[5].trim(),
              source: 'tsc',
            });
          }
        }
      }
    } catch {}

    setDiagnostics(results);
    setIsCheckingDiagnostics(false);
    // Broadcast ke CodeEditor buat squiggly markers (garis merah/kuning di kode)
    window.__nataDiag = results;
    window.dispatchEvent(new CustomEvent('nata-diagnostics', { detail: results }));
  }, [workspaceRoot, currentPath, isCheckingDiagnostics]);

  // Auto-run diagnostics saat workspace pertama kali dibuka
  useEffect(() => {
    if (workspaceRoot) runDiagnostics(workspaceRoot);
  }, [workspaceRoot]); // eslint-disable-line react-hooks/exhaustive-deps

  // Refresh Problems otomatis tiap AI agent selesai nulis/ngedit file
  useEffect(() => {
    const h = () => runDiagnostics();
    window.addEventListener('nata-run-diagnostics', h);
    return () => window.removeEventListener('nata-run-diagnostics', h);
  }, [runDiagnostics]);

  // Klik problem di panel → buka file di editor & lompat ke barisnya
  const handleOpenProblem = useCallback((d) => {
    if (!d?.file || d.file === '?') return;
    const abs = d.file.startsWith('/') ? d.file : `${workspaceRoot || currentPath}/${d.file}`;
    handleOpenFile(abs);
    // Kasih waktu editor mount/load file dulu, baru lompat
    setTimeout(() => window.dispatchEvent(new CustomEvent('nata-goto-line', { detail: { path: abs, line: d.line || 1, col: d.col || 1 } })), 150);
  }, [workspaceRoot, currentPath, handleOpenFile]);

  // ---- Render helpers ----------------------------------------------------

  if (!mode) return <LandingScreen onEnter={handleEnterMode} />;

  const activeMode = MODES.find(m => m.key === mode);
  const isProgrammer = mode === 'programmer'; // cowork punya shell sendiri ala Nata Cowork (chat = panggung utama)
  const pickCoworkFolder = async () => {
    try {
      const r = await window.electronAPI.openFolder();
      const p = typeof r === 'string' ? r : r?.path;
      if (p) { setCoworkRoot(p); localStorage.setItem('nata_cowork_root', p); }
    } catch {}
  };

  const handleBackToHub = () => {
    setMode(null); setWorkspaceRoot(null); setOpenTabs([]); setActiveTab(null); setTerminalLogs([]);
  };

  const titleBar = (
    <div className="title-bar" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
      <button onClick={handleBackToHub} style={{
        WebkitAppRegion: 'no-drag', background: 'transparent', border: 'none',
        color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', padding: '2px 6px'
      }}>
        <ArrowLeft size={14} /> Menu
      </button>
      <span className="glow-text">⌁ Nata IDE</span>
      {activeMode && (
        <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 10px', borderRadius: '12px', color: activeMode.color, background: 'rgba(255,255,255,0.04)', border: `1px solid ${activeMode.color}` }}>
          {activeMode.title}
        </span>
      )}
      {workspaceRoot && (
        <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
          {workspaceRoot.replace(/^\/Users\/[^/]+/, '~')}
        </span>
      )}
    </div>
  );

  // ---- Multi-tab chat panel ----------------------------------------------

  const chatPanel = (
    <div style={mode === 'cowork'
      ? { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', height: '100%' } /* Cowork: chat = panggung utama, lebar penuh */
      : { width: chatWidth, flexShrink: 0, display: 'flex', flexDirection: 'column', borderLeft: '1px solid var(--border-color)', height: '100%' }}>
      {/* Chat tabs strip */}
      <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--border-color)', background: 'rgba(7,8,12,0.7)', flexShrink: 0 }}>
        <div style={{ display: 'flex', flex: 1, overflowX: 'auto' }}>
          {chatTabs.map(tab => (
            <div key={tab.id} onClick={() => setActiveChatId(tab.id)} style={{
              display: 'flex', alignItems: 'center', gap: '5px', padding: '0 10px 0 12px',
              height: '34px', cursor: 'pointer', flexShrink: 0,
              borderRight: '1px solid var(--border-color)',
              borderBottom: activeChatId === tab.id ? '2px solid var(--accent-gemma)' : '2px solid transparent',
              background: activeChatId === tab.id ? 'rgba(255,255,255,0.04)' : 'transparent',
              color: activeChatId === tab.id ? 'var(--text-primary)' : 'var(--text-muted)',
            }}>
              <span style={{ fontSize: '12px', whiteSpace: 'nowrap', fontWeight: activeChatId === tab.id ? 600 : 400 }}>{tab.label}</span>
              <button onClick={e => { e.stopPropagation(); closeChatTab(tab.id); }} title="Tutup chat" style={{
                background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', padding: 0
              }}><X size={11} /></button>
            </div>
          ))}
        </div>
        <button onClick={addChatTab} title="Chat baru" style={{
          width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', flexShrink: 0
        }}><Plus size={14} /></button>
      </div>

      {/* Render semua ChatAgent, sembunyiin yang tidak aktif */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {chatTabs.map(tab => (
          <div key={tab.id} style={{ position: 'absolute', inset: 0, display: activeChatId === tab.id ? 'flex' : 'none', flexDirection: 'column' }}>
            <ChatAgent
              mode={mode}
              sessionId={`${mode}_${tab.id}`}
              active={activeChatId === tab.id}
              onRunCommand={handleRunCommand}
              onWriteFile={handleWriteFile}
              onDevServerStarted={adoptProcess}
              currentPath={mode === 'cowork' && coworkRoot ? coworkRoot : currentPath}
              activeFile={activeTab && currentPath ? (activeTab.startsWith(currentPath) ? activeTab.substring(currentPath.length).replace(/^\//, '') : activeTab) : (activeTab || '')}
              onAddChatTab={addChatTab}
              installedSkills={installedSkills}
            />
          </div>
        ))}
      </div>
    </div>
  );

  // ---- Editor area (multi-tab) -------------------------------------------

  const editorCenter = (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', minWidth: 0 }}>
      {/* Tab bar */}
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <EditorTabs
            tabs={openTabs}
            activeTab={activeTab}
            onSelect={setActiveTab}
            onClose={handleCloseTab}
            onNew={() => {
              const name = prompt('Nama file baru (boleh pakai folder, mis. src/Util.js):');
              if (!name) return;
              const p = name.startsWith('/') ? name : `${workspaceRoot || currentPath}/${name}`;
              window.electronAPI.createFile(p).then(r => {
                if (r?.success) { handleOpenFile(p); window.dispatchEvent(new CustomEvent('nata-refresh-tree')); }
                else alert('Gagal membuat file: ' + (r?.error || '?'));
              }).catch(() => {});
            }}
            onReorder={handleReorderTabs}
            workspaceRoot={workspaceRoot || currentPath}
          />
        </div>
        {activeTab && (
          <button
            onClick={() => setZen(v => !v)}
            title="Zen mode (Cmd+.)"
            style={{ background: zen ? 'rgba(96,165,250,0.15)' : 'transparent', border: 'none', color: zen ? '#60a5fa' : '#8e8e93', cursor: 'pointer', padding: '6px 8px', flexShrink: 0, fontSize: '11px', fontWeight: 700 }}
          >⛶</button>
        )}
        {activeTab && (
          <button
            onClick={() => setSplitTab(splitTab ? null : activeTab)}
            title={splitTab ? 'Tutup split' : 'Split editor — pin file ini di kanan'}
            style={{ background: splitTab ? 'rgba(96,165,250,0.15)' : 'transparent', border: 'none', color: splitTab ? '#60a5fa' : '#8e8e93', cursor: 'pointer', padding: '6px 10px', flexShrink: 0, fontSize: '11px', fontWeight: 700 }}
          >⊟ Split</button>
        )}
      </div>
      {/* Breadcrumb path */}
      {activeTab && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 14px', borderBottom: '1px solid rgba(255,255,255,0.04)', background: '#131315', fontSize: '11px', color: '#6b7280', fontFamily: '"JetBrains Mono", monospace', overflow: 'hidden', whiteSpace: 'nowrap' }}>
          {activeTab.replace(workspaceRoot || '', '').replace(/^\//, '').split('/').map((seg, i, arr) => (
            <span key={i} style={{ color: i === arr.length - 1 ? '#cbd5e1' : '#6b7280' }}>
              {seg}{i < arr.length - 1 ? '  ›  ' : ''}
            </span>
          ))}
        </div>
      )}
      {/* Editor / preview / welcome */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
        {activeTab && isImageFile(activeTab) ? (
          <ImagePreview filePath={activeTab} />
        ) : activeTab ? (
          <>
            <div style={{ flex: 1, minWidth: 0, display: 'flex', overflow: 'hidden', borderRight: splitTab ? '1px solid var(--border-color)' : 'none' }}>
              <CodeEditor key={activeTab} filePath={activeTab} onFileSaved={handleFileSaved} reloadSignal={editorReload} wordWrap={wordWrap} workspaceRoot={workspaceRoot} />
            </div>
            {splitTab && (
              <div style={{ flex: 1, minWidth: 0, display: 'flex', overflow: 'hidden' }}>
                <CodeEditor key={'split-' + splitTab} filePath={splitTab} onFileSaved={handleFileSaved} reloadSignal={editorReload} wordWrap={wordWrap} workspaceRoot={workspaceRoot} />
              </div>
            )}
          </>
        ) : (
          <div style={{
            flex: 1,
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '40px',
            background: 'radial-gradient(circle at 50% 30%, rgba(138, 43, 226, 0.08), transparent 60%)',
            color: 'var(--text-primary)',
            overflowY: 'auto'
          }}>
            <div style={{
              width: '100%',
              maxWidth: '560px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '32px'
            }}>
              {/* Brand and Status */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'linear-gradient(135deg, var(--accent-gemma), var(--accent-cyan))',
                  boxShadow: '0 8px 32px rgba(138, 43, 226, 0.25)',
                  border: '1px solid rgba(255,255,255,0.1)'
                }}>
                  <Cpu size={32} style={{ color: '#050508' }} />
                </div>
                <h1 style={{ fontSize: '24px', fontWeight: 800, letterSpacing: '0.02em', color: '#fff' }} className="glow-text">
                  Nata IDE
                </h1>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', textAlign: 'center' }}>
                  AI-powered local editor. Select a file or ask the agent to write code.
                </p>

                {/* Status Badge */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'rgba(52, 211, 153, 0.05)',
                  border: '1px solid rgba(52, 211, 153, 0.2)',
                  borderRadius: '100px',
                  padding: '4px 12px',
                  fontSize: '11.5px',
                  color: '#34d399',
                  fontWeight: 600,
                  marginTop: '8px'
                }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#34d399' }} />
                  <span>Local AI Connected</span>
                </div>
              </div>

              {/* Grid of Keyboard Shortcuts */}
              <div className="glass-panel" style={{
                width: '100%',
                padding: '20px 24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
                border: '1px solid rgba(255, 255, 255, 0.06)'
              }}>
                <h3 style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
                  Keyboard Shortcuts
                </h3>

                {[
                  { desc: 'Search Files', keys: ['⌘', 'P'] },
                  { desc: 'Command Palette', keys: ['⌘', 'Shift', 'P'] },
                  { desc: 'Find in Workspace', keys: ['⌘', 'Shift', 'F'] },
                  { desc: 'Toggle Terminal Panel', keys: ['Ctrl', '`'] },
                  { desc: 'Save Active File', keys: ['⌘', 'S'] }
                ].map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>{item.desc}</span>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      {item.keys.map((k, kIdx) => (
                        <kbd key={kIdx} style={{
                          background: 'rgba(255, 255, 255, 0.05)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          borderBottomWidth: '2px',
                          borderRadius: '4px',
                          padding: '2px 6px',
                          fontSize: '11px',
                          fontFamily: 'monospace',
                          color: '#fff',
                          fontWeight: 600
                        }}>{k}</kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Quick Actions Row */}
              <div style={{ display: 'flex', gap: '12px', width: '100%' }}>
                <button 
                  onClick={addChatTab}
                  className="glass-card" 
                  style={{
                    flex: 1,
                    padding: '12px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255,255,255,0.06)',
                    background: 'rgba(255,255,255,0.02)',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#fff',
                    textAlign: 'center',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = 'var(--accent-gemma)';
                    e.currentTarget.style.background = 'rgba(138, 43, 226, 0.05)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)';
                    e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
                  }}
                >
                  + New Chat
                </button>
                <button 
                  onClick={() => runDiagnostics()}
                  disabled={isCheckingDiagnostics}
                  className="glass-card" 
                  style={{
                    flex: 1,
                    padding: '12px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255,255,255,0.06)',
                    background: 'rgba(255,255,255,0.02)',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#fff',
                    textAlign: 'center',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = 'var(--accent-cyan)';
                    e.currentTarget.style.background = 'rgba(0, 245, 255, 0.05)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)';
                    e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
                  }}
                >
                  {isCheckingDiagnostics ? 'Checking...' : '🔍 Run Diagnostics'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      {/* Bottom panel (Problems / Terminal / Output / Debug / Ports) */}
      {/* Handle tarik naik-turun panel bawah */}
      <div
        onMouseDown={dragBottom}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(96,165,250,0.4)'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        style={{ height: '5px', marginBottom: '-5px', cursor: 'row-resize', flexShrink: 0, zIndex: 6, background: 'transparent', position: 'relative' }}
        title="Geser buat ubah tinggi panel"
      />
      <BottomPanel
        logs={terminalLogs}
        isRunning={isRunningCommand}
        onKill={handleKillCommand}
        onClear={() => setTerminalLogs([])}
        onRunCommand={handleRunCommand}
        currentPath={currentPath}
        sysUser={sysUser}
        sysHost={sysHost}
        diagnostics={diagnostics}
        isCheckingDiagnostics={isCheckingDiagnostics}
        onRunDiagnostics={() => runDiagnostics(null, true)}
        onOpenProblem={handleOpenProblem}
        activeProcessId={activeProcessId}
        activeTab={bottomTab}
        setActiveTab={setBottomTab}
        height={bottomHeight}
      />

      {/* Browser Preview — ngambang di atas EDITOR. right dihitung dari lebar chat
          biar JANGAN pernah nutupin panel chat kanan (keluhan user). */}
      {previewUrl && (
        <div style={{ position: 'fixed', top: '46px', right: (zen ? 8 : chatWidth + 18) + 'px', bottom: (bottomHeight + 12) + 'px', width: 'min(40vw, 640px)', maxWidth: `calc(100vw - ${(zen ? 8 : chatWidth + 18) + 70}px)`, zIndex: 60, display: 'flex', flexDirection: 'column', background: '#0d0e13', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 12px 40px rgba(0,0,0,0.5)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 8px', borderBottom: '1px solid rgba(255,255,255,0.08)', background: '#0a0b0f' }}>
            <span style={{ fontSize: '12px' }}>🌐</span>
            <input
              value={previewUrl}
              onChange={e => setPreviewUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && setPreviewKey(k => k + 1)}
              spellCheck={false}
              style={{ flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', color: '#e5e7eb', fontSize: '11.5px', padding: '4px 8px', outline: 'none', fontFamily: 'monospace' }}
            />
            {[['↺', 'Reload', () => setPreviewKey(k => k + 1)], ['↗', 'Buka di browser', () => window.open(previewUrl, '_blank')], ['✕', 'Tutup', () => setPreviewUrl(null)]].map(([ic, tt, fn]) => (
              <button key={tt} onClick={fn} title={tt} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', color: '#cbd5e1', cursor: 'pointer', padding: '3px 8px', fontSize: '12px' }}>{ic}</button>
            ))}
          </div>
          <webview key={previewKey} src={previewUrl} style={{ flex: 1, background: '#fff' }} />
        </div>
      )}
    </div>
  );

  // ===== Mode programmer: welcome screen =====
  if (isProgrammer && !workspaceRoot) {
    return (
      <div className="app-container">
        {titleBar}
        <div className="main-content">
          <ProgrammerWelcome onOpenFolder={handleOpenFolder} />
          {chatPanel}
        </div>
      </div>
    );
  }

  // ===== Mode programmer: workbench =====
  if (isProgrammer) {
    const sidebarPanel = (() => {
      switch (activeView) {
        case 'explorer': return <FileExplorer rootPath={workspaceRoot} onOpenFile={handleOpenFile} currentOpenFile={activeTab} />;
        case 'search':   return <SearchPanel rootPath={workspaceRoot} onOpenFile={handleOpenFile} />;
        case 'scm':      return <SourceControlPanel rootPath={workspaceRoot} />;
        case 'skills':   return <SkillsPanel workspaceRoot={workspaceRoot} onSkillsChange={setInstalledSkills} />;
        case 'run':      return <PlaceholderPanel title="Run & Debug" note="Jalanin program lewat Terminal dulu ya cuy. Debugger visual nyusul." />;
        case 'ext':      return <PlaceholderPanel title="Extensions" note="Marketplace ekstensi belum ada." />;
        default:         return null;
      }
    })();

    const paletteActions = [
      { label: 'File Baru', hint: 'Explorer', run: () => setActiveView('explorer') },
      { label: 'Buka Folder...', hint: 'Workspace', run: () => handleOpenFolder && handleOpenFolder() },
      { label: 'Cari di File (Search)', hint: 'Cmd+Shift+F', run: () => setActiveView('search') },
      { label: 'Source Control (Git)', run: () => setActiveView('scm') },
      { label: 'Skills', run: () => setActiveView('skills') },
      { label: 'Chat Baru', run: () => addChatTab() },
      { label: 'Bersihkan Terminal', run: () => setTerminalLogs([]) },
      { label: 'Jalankan Diagnostics', run: () => runDiagnostics() },
      { label: 'Ganti Tema Editor (dark/light)', run: () => {
        const cur = localStorage.getItem('nata_editor_theme') || 'vs-dark';
        const next = cur === 'vs-dark' ? 'light' : cur === 'light' ? 'hc-black' : 'vs-dark';
        localStorage.setItem('nata_editor_theme', next);
        setEditorReload(n => n + 1);
      } },
      { label: 'Toggle Word Wrap (Alt+Z)', run: () => {
        setWordWrap(w => {
          const next = !w;
          localStorage.setItem('nata_word_wrap', next ? 'on' : 'off');
          toast(`Word Wrap: ${next ? 'ON' : 'OFF'}`, 'info');
          return next;
        });
      } },
      { label: 'Generate Unit Test (Active File)', run: () => {
        if (!activeTab) { toast('Buka file kode dulu, cuy', 'error'); return; }
        const name = activeTab.split('/').pop();
        window.dispatchEvent(new CustomEvent('nata-chat-prompt', { 
          detail: `Tolong buatkan unit test yang komprehensif untuk file \`${name}\` ini. Pastikan test mencakup berbagai skenario.` 
        }));
      } },
      { label: 'Quick Open File (Cmd+P)', run: () => setQuickOpenShow(true) },
      { label: 'Pintasan Keyboard (Keyboard Shortcuts Reference)', run: () => setShowShortcutsRef(true) },
      { label: 'Pengaturan (Settings)', run: () => setSettingsOpen(true) },
      { label: 'Toggle Tab-Autocomplete AI', run: () => {
        const off = localStorage.getItem('nata_autocomplete') === 'off';
        localStorage.setItem('nata_autocomplete', off ? 'on' : 'off');
        alert(`Tab-autocomplete AI: ${off ? 'ON' : 'OFF'}`);
      } },
      { label: 'Cek Update', run: async () => {
        const feed = localStorage.getItem('nata_update_feed') || '';
        if (!feed) { const u = prompt('URL update feed (version.json). Kosongkan untuk batal:'); if (!u) return; localStorage.setItem('nata_update_feed', u.trim()); }
        const r = await window.electronAPI.checkUpdate(localStorage.getItem('nata_update_feed'));
        if (!r.success) { alert('Cek update gagal: ' + r.error); return; }
        if (r.newer) { if (confirm(`Update tersedia: v${r.latest} (sekarang v${r.current}).\n${r.notes}\n\nBuka halaman download?`)) window.electronAPI.openExternal(r.url); }
        else alert(`Sudah versi terbaru (v${r.current}).`);
      } },
      { label: 'Tutup Workspace', run: () => handleBackToHub() },
    ];
    return (
      <ErrorBoundary>
      <div className="app-container">
        {titleBar}
        <div className="main-content">
          {!zen && <ActivityBar activeView={activeView} onSelect={setActiveView} onSettings={handleBackToHub} />}
          {!zen && activeView && (
            <>
              <div style={{ width: sidebarWidth, flexShrink: 0, borderRight: '1px solid var(--border-color)', height: '100%' }}>
                {sidebarPanel}
              </div>
              <Resizer side="right" onResize={resizeSidebar} />
            </>
          )}
          {editorCenter}
          {!zen && <Resizer side="left" onResize={resizeChat} />}
          {!zen && chatPanel}
        </div>

        {/* Global Status Bar */}
        {workspaceRoot && (
          <div style={{
            height: '24px',
            borderTop: '1px solid var(--border-color)',
            background: '#0d0e13',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 12px',
            fontSize: '11px',
            color: 'var(--text-secondary)',
            fontFamily: '"Outfit", -apple-system, BlinkMacSystemFont, sans-serif',
            userSelect: 'none',
            zIndex: 10,
            flexShrink: 0
          }}>
            {/* Left elements */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              {gitBranch && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }} onClick={() => runDiagnostics(workspaceRoot)} title="Klik untuk segarkan status git & diagnostics">
                  <GitBranch size={12} style={{ color: 'var(--accent-cyan)' }} />
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{gitBranch}</span>
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Workspace:</span>
                <span style={{ fontFamily: 'monospace' }}>{currentPath.replace(/^\/Users\/[^\/]+/, '~')}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ color: 'var(--accent-gemma)' }}>✨</span>
                <span>Model: <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{localStorage.getItem('nata_model') || 'qwen3:4b-instruct'}</span></span>
              </div>
            </div>
            
            {/* Right elements */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              {/* Problems section */}
              <div 
                onClick={() => {
                  setBottomTab('problems');
                }} 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '4px', 
                  cursor: 'pointer',
                  padding: '2px 6px',
                  borderRadius: '4px'
                }} 
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                title="Buka panel masalah/problems"
              >
                {(() => {
                  const errs = (diagnostics || []).filter(d => d.type === 'error').length;
                  const warns = (diagnostics || []).filter(d => d.type === 'warning').length;
                  if (errs > 0 || warns > 0) {
                    return (
                      <span style={{ color: errs > 0 ? 'var(--accent-magenta)' : '#fbbf24', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                        {errs > 0 ? `✕ ${errs}` : ''} {warns > 0 ? `⚠ ${warns}` : ''}
                      </span>
                    );
                  }
                  return <span style={{ color: '#34d399', display: 'flex', alignItems: 'center', gap: '4px' }}>✓ No Problems</span>;
                })()}
              </div>

              {/* Autocomplete status */}
              <div 
                onClick={() => {
                  const current = localStorage.getItem('nata_autocomplete') !== 'off';
                  localStorage.setItem('nata_autocomplete', current ? 'off' : 'on');
                  setEditorReload(n => n + 1);
                  toast(`Tab Autocomplete: ${current ? 'OFF' : 'ON'}`, 'info');
                }}
                style={{ cursor: 'pointer', padding: '2px 6px', borderRadius: '4px' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                title="Klik untuk toggle autocomplete tab"
              >
                <span>Autocomplete: </span>
                <span style={{ fontWeight: 600, color: (localStorage.getItem('nata_autocomplete') !== 'off') ? '#34d399' : 'var(--text-muted)' }}>
                  {(localStorage.getItem('nata_autocomplete') !== 'off') ? 'ON' : 'OFF'}
                </span>
              </div>

              {/* Word Wrap status */}
              <div 
                onClick={() => {
                  setWordWrap(w => {
                    const next = !w;
                    localStorage.setItem('nata_word_wrap', next ? 'on' : 'off');
                    toast(`Word Wrap: ${next ? 'ON' : 'OFF'}`, 'info');
                    return next;
                  });
                }}
                style={{ cursor: 'pointer', padding: '2px 6px', borderRadius: '4px' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                title="Klik atau tekan Alt+Z untuk toggle word wrap"
              >
                <span>Wrap: </span>
                <span style={{ fontWeight: 600, color: wordWrap ? '#34d399' : 'var(--text-muted)' }}>
                  {wordWrap ? 'ON' : 'OFF'}
                </span>
              </div>

              {/* Notification Bell */}
              <div 
                onClick={toggleNotificationCenter}
                style={{ 
                  cursor: 'pointer', 
                  padding: '2px 6px', 
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  position: 'relative'
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                title="Buka Pusat Notifikasi"
              >
                <Bell size={12} style={{ color: unreadNotifications > 0 ? 'var(--accent-cyan)' : 'var(--text-muted)' }} />
                {unreadNotifications > 0 && (
                  <span style={{ 
                    background: 'var(--accent-magenta)', 
                    color: '#fff', 
                    fontSize: '8px', 
                    fontWeight: 800, 
                    borderRadius: '50%',
                    width: '12px',
                    height: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'absolute',
                    top: '-4px',
                    right: '-4px',
                    boxShadow: '0 0 5px rgba(255, 0, 127, 0.6)'
                  }}>
                    {unreadNotifications}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} actions={paletteActions} />
        <QuickOpen open={quickOpenShow} onClose={() => setQuickOpenShow(false)} root={workspaceRoot || currentPath} onOpenFile={handleOpenFile} />
        <SettingsModal open={settingsOpen} onClose={(saved) => { setSettingsOpen(false); if (saved) { setEditorReload(n => n + 1); toast('Pengaturan disimpan', 'success'); } }} />
        <ToastHost />
        <KeyboardShortcutsModal open={showShortcutsRef} onClose={() => setShowShortcutsRef(false)} />
        <NotificationCenter 
          open={showNotificationCenter} 
          onClose={() => setShowNotificationCenter(false)} 
          notifications={notifications}
          onClear={() => { setNotifications([]); setUnreadNotifications(0); }}
          onMarkAllRead={() => {
            setNotifications(prev => prev.map(n => ({ ...n, read: true })));
            setUnreadNotifications(0);
          }}
        />
        <OnboardingTour open={showOnboarding} onComplete={() => { setShowOnboarding(false); localStorage.setItem('nata_onboarded', 'true'); }} sidebarWidth={sidebarWidth} chatWidth={chatWidth} />
      </div>
      </ErrorBoundary>
    );
  }

  // ===== Mode lain (gambar/scrape/docs/alarm/terminal) =====
  // ── Shell khusus Cowork ala Nata Cowork ─────────────────────────────────
  // Chat GEDE di tengah sebagai panggung utama, panel "Hasil Kerja" (file
  // workspace) di kanan, tanpa keribetan IDE. AI-nya tetap agent penuh.
  if (mode === 'cowork') {
    const coworkDir = coworkRoot || currentPath;
    return (
      <ErrorBoundary>
      <div className="app-container">
        {titleBar}
        <div className="main-content" style={{ display: 'flex' }}>
          {/* Chat = panggung utama */}
          {chatPanel}
          <Resizer side="right" onResize={(d) => resizeSidebar(-d)} />
          {/* Panel Hasil Kerja — file yang dibuat/diubah AI */}
          <div style={{ width: sidebarWidth, flexShrink: 0, display: 'flex', flexDirection: 'column', borderLeft: '1px solid var(--border-color)', height: '100%', background: 'rgba(9,10,15,0.5)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', borderBottom: '1px solid var(--border-color)' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#e5e7eb', flex: 1 }}>📁 Hasil Kerja</span>
              <button onClick={pickCoworkFolder} title={`Workspace: ${coworkDir}\nKlik buat ganti folder`}
                style={{ background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.3)', borderRadius: '6px', color: '#60a5fa', fontSize: '10.5px', fontWeight: 700, padding: '3px 8px', cursor: 'pointer' }}>
                {coworkDir.split('/').pop() || 'Pilih Folder'} ▾
              </button>
            </div>
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <FileExplorer rootPath={coworkDir} onOpenFile={(p) => window.electronAPI.revealPath(p)} currentOpenFile={null} />
            </div>
          </div>
        </div>
        <ToastHost />
      </div>
      </ErrorBoundary>
    );
  }

  // Layout beda dari Programmer IDE: KIRI = panel hasil sesuai fungsi mode
  // (galeri gambar / daftar dokumen / feed scrape / alarm / konsol),
  // KANAN = chat AI yang ngerjain tugasnya. Live update via event nata-tool-ran.
  return (
    <ErrorBoundary>
    <div className="app-container">
      {titleBar}
      <div className="main-content">
        <ModeWorkspace mode={mode} currentPath={currentPath} />
        <Resizer side="left" onResize={resizeChat} />
        {chatPanel}
      </div>
      <ToastHost />
    </div>
    </ErrorBoundary>
  );
}
