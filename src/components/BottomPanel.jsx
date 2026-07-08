import React, { useState, useEffect, useRef } from 'react';
import { Square, Trash2, CircleDot, AlertTriangle, Info, Bug, Server, Terminal, ChevronRight } from 'lucide-react';

const TABS = [
  { key: 'terminal', label: 'Terminal',       icon: Terminal },
  { key: 'problems', label: 'Problems',       icon: AlertTriangle },
  { key: 'output',   label: 'Output',         icon: Info },
  { key: 'debug',    label: 'Debug Console',  icon: Bug },
  { key: 'ports',    label: 'Ports',          icon: Server },
];

// ── Self-contained terminal (buat tab terminal tambahan) ────────────────────
function SelfTerminal({ currentPath, sysUser, sysHost }) {
  const [logs, setLogs] = useState([]);
  const [running, setRunning] = useState(false);
  const [pid, setPid] = useState(null);
  const [cmd, setCmd] = useState('');
  const [hist, setHist] = useState([]);
  const [hIdx, setHIdx] = useState(-1);
  const endRef = useRef(null);
  const inputRef = useRef(null);
  const MONO = '"JetBrains Mono", "Menlo", monospace';
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'auto' }); }, [logs]);

  const shortPath = (currentPath || '~').replace(/^\/Users\/[^/]+/, '~');
  const prompt = `${sysUser || 'user'}@${sysHost || 'localhost'} ${shortPath.split('/').pop() || '~'} %`;

  const run = (command) => {
    const id = 'uterm_' + Math.random().toString(36).slice(2) + Date.now();
    setPid(id); setRunning(true);
    setLogs(p => [...p, { type: 'system', text: `\n$ ${command}` }]);
    const cOut = window.electronAPI.onTerminalOut(id, d => setLogs(p => [...p, { type: 'out', text: d }]));
    const cErr = window.electronAPI.onTerminalErr(id, d => setLogs(p => [...p, { type: 'err', text: d }]));
    const cClose = window.electronAPI.onTerminalClose(id, code => {
      setLogs(p => [...p, { type: 'system', text: `[Keluar: ${code}]` }]);
      cOut(); cErr(); cClose(); setRunning(false); setPid(null);
    });
    window.electronAPI.executeCommand(command, currentPath, id).catch(() => { setRunning(false); setPid(null); });
  };
  const submit = (e) => {
    e.preventDefault();
    const t = cmd; if (!t && !running) return; setCmd('');
    if (running && pid) window.electronAPI.sendStdin(pid, t + '\n').catch(() => {});
    else if (t.trim()) { setHist(p => [t.trim(), ...p.slice(0, 49)]); setHIdx(-1); run(t.trim()); }
  };
  const onKey = (e) => {
    if (e.key === 'ArrowUp' && !running) { e.preventDefault(); const n = Math.min(hIdx + 1, hist.length - 1); setHIdx(n); setCmd(hist[n] || ''); }
    else if (e.key === 'ArrowDown' && !running) { e.preventDefault(); const n = Math.max(hIdx - 1, -1); setHIdx(n); setCmd(n < 0 ? '' : hist[n]); }
    else if (e.key === 'c' && e.ctrlKey && running && pid) window.electronAPI.sendStdin(pid, '\x03').catch(() => {});
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#0d0e13' }} onClick={() => inputRef.current?.focus()}>
      <div className="sel" style={{ flex: 1, overflowY: 'auto', padding: '6px 0', fontFamily: MONO, fontSize: '12.5px', lineHeight: '1.6', cursor: 'text' }}>
        {logs.length === 0 && <div style={{ padding: '0 14px 4px', color: '#374151', fontSize: '11px', fontStyle: 'italic' }}>Terminal baru — ready.</div>}
        {logs.map((log, i) => (
          <div key={i} className="terminal-line" style={{ color: log.type === 'err' ? '#f87171' : log.type === 'system' ? '#60a5fa' : '#d1d5db', whiteSpace: 'pre-wrap', wordBreak: 'break-all', padding: '0 14px' }}>{log.text}</div>
        ))}
        <form onSubmit={submit} style={{ display: 'flex', alignItems: 'center', padding: '0 14px' }}>
          <span style={{ color: running ? '#fbbf24' : '#34d399', userSelect: 'none', whiteSpace: 'nowrap', marginRight: '6px', fontFamily: MONO, fontSize: '12.5px', flexShrink: 0 }}>{running ? '→' : prompt}</span>
          <input ref={inputRef} value={cmd} onChange={e => setCmd(e.target.value)} onKeyDown={onKey} autoComplete="off" spellCheck={false}
            placeholder={running ? 'stdin — Enter kirim, Ctrl+C stop' : ''}
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: running ? '#fbbf24' : '#f9fafb', fontFamily: MONO, fontSize: '12.5px', minWidth: 0, padding: 0 }} />
        </form>
        <div ref={endRef} />
      </div>
    </div>
  );
}

// ── Terminal ────────────────────────────────────────────────────────────────
function TerminalTab({ logs, isRunning, onRunCommand, currentPath, sysUser, sysHost, activeProcessId }) {
  const endRef   = useRef(null);
  const inputRef = useRef(null);
  const [cmd, setCmd]     = useState('');
  const [hist, setHist]   = useState(() => { try { return JSON.parse(localStorage.getItem('nata_term_hist') || '[]'); } catch { return []; } });
  const [hIdx, setHIdx]   = useState(-1);
  useEffect(() => { try { localStorage.setItem('nata_term_hist', JSON.stringify(hist.slice(0, 50))); } catch {} }, [hist]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'auto' });
  }, [logs]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [isRunning]);

  const shortPath = (currentPath || '~').replace(/^\/Users\/[^/]+/, '~');
  const promptUser = sysUser || 'user';
  const promptHost = sysHost || 'localhost';
  const promptDir  = shortPath.split('/').pop() || '~';
  const prompt     = `${promptUser}@${promptHost} ${promptDir} %`;

  const submit = (e) => {
    e.preventDefault();
    const t = cmd;
    if (!t && !isRunning) return;
    setCmd('');
    if (isRunning && activeProcessId) {
      // Kirim sebagai stdin ke proses yang lagi jalan
      window.electronAPI.sendStdin(activeProcessId, t + '\n').catch(() => {});
    } else if (t.trim()) {
      setHist(p => [t.trim(), ...p.slice(0, 49)]);
      setHIdx(-1);
      onRunCommand?.(t.trim());
    }
  };

  const onKey = (e) => {
    if (e.key === 'ArrowUp' && !isRunning) {
      e.preventDefault();
      const n = Math.min(hIdx + 1, hist.length - 1);
      setHIdx(n); setCmd(hist[n] || '');
    } else if (e.key === 'ArrowDown' && !isRunning) {
      e.preventDefault();
      const n = Math.max(hIdx - 1, -1);
      setHIdx(n); setCmd(n < 0 ? '' : hist[n]);
    } else if (e.key === 'c' && e.ctrlKey && isRunning && activeProcessId) {
      // Ctrl+C → kirim SIGINT via stdin
      window.electronAPI.sendStdin(activeProcessId, '\x03').catch(() => {});
    }
  };

  const MONO = '"JetBrains Mono", "Menlo", monospace';

  return (
    <div
      style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#0d0e13' }}
      onClick={() => inputRef.current?.focus()}
    >
      {/* Output + input nyatu dalam satu alur (prompt inline di bawah output terakhir, kayak terminal beneran) */}
      <div
        className="sel"
        style={{ flex: 1, overflowY: 'auto', padding: '6px 0', fontFamily: MONO, fontSize: '12.5px', lineHeight: '1.6', cursor: 'text' }}
      >
        {logs.length === 0 && (
          <div style={{ padding: '0 14px 4px 14px', color: '#374151', fontSize: '11px', fontStyle: 'italic' }}>
            Nata IDE Terminal — ready.
          </div>
        )}
        {logs.map((log, i) => {
          const color = log.type === 'err'    ? '#f87171'
                      : log.type === 'system' ? '#60a5fa'
                      : '#d1d5db';
          return (
            <div key={i} className="terminal-line" style={{ color, whiteSpace: 'pre-wrap', wordBreak: 'break-all', padding: '0 14px' }}>
              {log.text}
            </div>
          );
        })}

        {/* Baris prompt inline — nempel langsung di bawah output, naik ke atas kalau output dikit */}
        <form onSubmit={submit} style={{ display: 'flex', alignItems: 'center', padding: '0 14px', gap: '0' }}>
          <span style={{
            color: isRunning ? '#fbbf24' : '#34d399',
            userSelect: 'none', whiteSpace: 'nowrap', marginRight: '6px',
            fontFamily: MONO, fontSize: '12.5px', flexShrink: 0
          }}>
            {isRunning ? '→' : prompt}
          </span>
          <input
            ref={inputRef}
            value={cmd}
            onChange={e => setCmd(e.target.value)}
            onKeyDown={onKey}
            autoComplete="off"
            spellCheck={false}
            placeholder={isRunning ? 'stdin — ketik & Enter kirim ke proses, Ctrl+C stop' : ''}
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              color: isRunning ? '#fbbf24' : '#f9fafb',
              fontFamily: MONO, fontSize: '12.5px',
              WebkitUserSelect: 'text', userSelect: 'text', minWidth: 0, padding: 0,
            }}
          />
        </form>
        <div ref={endRef} />
      </div>

      <style>{`@keyframes blink { 50% { opacity: 0; } }`}</style>
    </div>
  );
}

// ── Problems ────────────────────────────────────────────────────────────────
function ProblemsPanel({ diagnostics, isChecking, onRunDiagnostics, onOpenProblem }) {
  const errors   = (diagnostics || []).filter(d => d.type === 'error');
  const warnings = (diagnostics || []).filter(d => d.type === 'warning');

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 12px', borderBottom: '1px solid rgba(255,255,255,0.05)', flexShrink: 0 }}>
        <span style={{ fontSize: '11px', color: '#4a5568' }}>
          {isChecking ? '⟳ Memeriksa kode...' : `${errors.length} error, ${warnings.length} warning`}
        </span>
        <button
          onClick={onRunDiagnostics}
          disabled={isChecking}
          style={{ marginLeft: 'auto', fontSize: '11px', color: '#60a5fa', background: 'none', border: 'none', cursor: isChecking ? 'default' : 'pointer', opacity: isChecking ? 0.5 : 1 }}
        >
          {isChecking ? 'Memeriksa...' : '↺ Periksa Sekarang'}
        </button>
      </div>

      {/* Empty state */}
      {!isChecking && diagnostics.length === 0 && (
        <div style={{ padding: '20px 14px', fontSize: '12px', color: '#374151', textAlign: 'center' }}>
          <div style={{ fontSize: '20px', marginBottom: '6px' }}>✓</div>
          <div>Tidak ada masalah terdeteksi.</div>
          <div style={{ fontSize: '11px', color: '#4a5568', marginTop: '4px' }}>ESLint / TypeScript akan diperiksa otomatis saat folder dibuka.</div>
        </div>
      )}

      {/* Diagnostics list — VS Code style: klik = lompat ke baris, hover = tombol Fix AI */}
      <div className="sel" style={{ flex: 1, overflowY: 'auto' }}>
        {[...errors, ...warnings].map((d, i) => (
          <div key={i}
            onClick={() => onOpenProblem?.(d)}
            title={`Klik buat buka ${d.file}${d.line ? `:${d.line}` : ''}`}
            style={{
              display: 'flex', gap: '8px', padding: '5px 12px', fontSize: '12px',
              borderBottom: '1px solid rgba(255,255,255,0.03)',
              alignItems: 'flex-start', cursor: 'pointer',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; const b = e.currentTarget.querySelector('.fixbtn'); if (b) b.style.opacity = '1'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; const b = e.currentTarget.querySelector('.fixbtn'); if (b) b.style.opacity = '0'; }}
          >
            {/* Icon */}
            <span style={{ flexShrink: 0, marginTop: '1px', color: d.type === 'error' ? '#f87171' : '#fbbf24' }}>
              {d.type === 'error' ? '✕' : '⚠'}
            </span>
            {/* Message */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: '#e5e7eb', wordBreak: 'break-word' }}>{d.message}</div>
              <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px', fontFamily: 'monospace' }}>
                {d.file}{d.line ? `:${d.line}` : ''}{d.col ? `:${d.col}` : ''}
                {d.source && <span style={{ marginLeft: '6px', color: '#374151' }}>[{d.source}]</span>}
              </div>
            </div>
            {/* Tombol Fix — muncul pas hover, kirim problem ke AI chat */}
            <button className="fixbtn"
              onClick={(e) => {
                e.stopPropagation();
                window.dispatchEvent(new CustomEvent('nata-chat-prompt', {
                  detail: `Perbaiki problem ini di project:\n\n\`${d.file}:${d.line || '?'}${d.col ? ':' + d.col : ''}\` [${d.source || 'lint'}] ${d.type}: ${d.message}\n\nBaca dulu file \`${d.file}\` di sekitar baris ${d.line || 1} pakai bash, lalu perbaiki pakai edit block. Pastikan setelah itu error-nya hilang.`
                }));
              }}
              title="Suruh AI perbaiki problem ini"
              style={{
                opacity: 0, transition: 'opacity 0.12s', flexShrink: 0, alignSelf: 'center',
                background: 'rgba(192,132,252,0.15)', border: '1px solid rgba(192,132,252,0.35)',
                color: '#c084fc', borderRadius: '5px', padding: '2px 8px',
                fontSize: '10.5px', fontWeight: 700, cursor: 'pointer',
              }}>✨ Fix</button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Output ──────────────────────────────────────────────────────────────────
function OutputPanel() {
  return <div style={{ padding: '14px', fontSize: '12px', color: '#4a5568' }}>Output build/lint akan muncul di sini.</div>;
}

// ── Debug / Run launcher ─────────────────────────────────────────────────────
function DebugPanel({ onRunCommand, currentPath }) {
  const [scripts, setScripts] = useState([]);
  useEffect(() => {
    if (!currentPath) return;
    window.electronAPI.readFile(`${currentPath}/package.json`).then(r => {
      if (r?.success) { try { const pkg = JSON.parse(r.content); setScripts(Object.keys(pkg.scripts || {})); } catch {} }
      else setScripts([]);
    }).catch(() => setScripts([]));
  }, [currentPath]);

  const configs = [
    { label: '🐛 node --inspect (debug)', cmd: 'node --inspect index.js' },
    { label: '🐍 python main.py', cmd: 'python3 main.py' },
  ];
  return (
    <div style={{ padding: '12px 14px', overflowY: 'auto' }}>
      <div style={{ fontSize: '11px', color: '#718096', marginBottom: '10px' }}>
        Run & Debug — klik buat jalanin di Terminal. <code>--inspect</code> kasih URL DevTools.
      </div>
      {scripts.length > 0 && (
        <>
          <div style={{ fontSize: '10px', color: '#5f6475', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>npm scripts (package.json)</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px' }}>
            {scripts.map(s => (
              <button key={s} onClick={() => onRunCommand?.(`npm run ${s}`)} style={{
                textAlign: 'left', background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)',
                borderRadius: '6px', color: '#6ee7b7', padding: '8px 12px', fontSize: '12.5px', cursor: 'pointer', fontFamily: '"JetBrains Mono", monospace',
              }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(52,211,153,0.16)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(52,211,153,0.08)'}
              >▶ npm run {s}</button>
            ))}
          </div>
          <div style={{ fontSize: '10px', color: '#5f6475', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>lainnya</div>
        </>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {configs.map(c => (
          <button key={c.cmd} onClick={() => onRunCommand?.(c.cmd)} style={{
            textAlign: 'left', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '6px', color: '#cbd5e1', padding: '8px 12px', fontSize: '12.5px', cursor: 'pointer',
            fontFamily: '"JetBrains Mono", monospace',
          }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(99,179,237,0.12)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
          >{c.label}</button>
        ))}
      </div>
    </div>
  );
}

// ── Ports ───────────────────────────────────────────────────────────────────
function PortsPanel() {
  const [ports, setPorts] = useState([]);
  const [scanning, setScanning] = useState(false);

  const hint = p => ({ 5173: 'Vite Dev', 3000: 'React/Next', 8080: 'HTTP', 4173: 'Vite Preview', 8888: 'Jupyter', 3001: 'Alt Dev', 8000: 'Django/Flask', 9229: 'Node Debug' }[p] || '');

  const checkPort = port => {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 500);
    return fetch(`http://localhost:${port}`, { signal: ctrl.signal, mode: 'no-cors' })
      .then(() => { clearTimeout(t); return true; })
      .catch(() => { clearTimeout(t); return false; });
  };

  const refresh = async () => {
    setScanning(true);
    const candidates = [3000, 3001, 4173, 5173, 8000, 8080, 8888, 9000, 9229];
    const results = await Promise.all(candidates.map(p => checkPort(p).then(ok => ({ p, ok }))));
    setPorts(results.filter(r => r.ok).map(r => ({ port: r.p, hint: hint(r.p) })));
    setScanning(false);
  };

  useEffect(() => { refresh(); }, []);

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '10px 14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <span style={{ fontSize: '11px', color: '#4a5568' }}>{scanning ? '🔍 Scanning...' : 'Port aktif di localhost'}</span>
        <button onClick={refresh} disabled={scanning} style={{ fontSize: '11px', color: '#63b3ed', background: 'none', border: 'none', cursor: scanning ? 'default' : 'pointer' }}>Refresh</button>
      </div>
      {!scanning && ports.length === 0 && (
        <div style={{ fontSize: '12px', color: '#4a5568' }}>Tidak ada dev server terdeteksi.</div>
      )}
      {ports.map(p => (
        <div key={p.port} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '12px' }}>
          <CircleDot size={11} style={{ color: '#68d391' }} />
          <span style={{ fontFamily: 'monospace', color: '#63b3ed' }}>{p.port}</span>
          <span style={{ color: '#718096' }}>{p.hint}</span>
          <button onClick={() => window.dispatchEvent(new CustomEvent('nata-preview', { detail: `http://localhost:${p.port}` }))} style={{ marginLeft: 'auto', fontSize: '11px', color: '#63b3ed', background: 'none', border: 'none', cursor: 'pointer' }}>Preview 🌐</button>
          <a href={`http://localhost:${p.port}`} target="_blank" rel="noreferrer" style={{ fontSize: '11px', color: '#63b3ed' }}>Buka ↗</a>
        </div>
      ))}
    </div>
  );
}

// ── Main ────────────────────────────────────────────────────────────────────
export default function BottomPanel({ logs, isRunning, onKill, onClear, onRunCommand, currentPath, sysUser, sysHost, diagnostics = [], isCheckingDiagnostics = false, onRunDiagnostics, onOpenProblem, defaultTab = 'terminal', activeProcessId = null, activeTab, setActiveTab, height }) {
  const [localActive, setLocalActive] = useState(defaultTab);
  const active = activeTab !== undefined ? activeTab : localActive;
  const setActive = setActiveTab !== undefined ? setActiveTab : setLocalActive;
  const errCount = (diagnostics || []).filter(d => d.type === 'error').length;
  // Multi-terminal: 'main' = terminal utama (AI/App), sisanya self-contained
  const [terms, setTerms] = useState([{ id: 'main', label: 'Terminal' }]);
  const [activeTerm, setActiveTerm] = useState('main');
  const addTerm = () => {
    const id = 't' + Date.now();
    setTerms(p => [...p, { id, label: `Terminal ${p.length + 1}` }]);
    setActiveTerm(id);
    setActive('terminal');
  };
  const closeTerm = (id) => {
    setTerms(p => p.filter(t => t.id !== id));
    setActiveTerm(a => a === id ? 'main' : a);
  };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      borderTop: '1px solid rgba(255,255,255,0.06)',
      background: '#0d0e13', flexShrink: 0, height: (height || 220) + 'px',
    }}>
      {/* Tab strip */}
      <div style={{
        display: 'flex', alignItems: 'center',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        background: '#0a0b0f', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', flex: 1, overflowX: 'auto' }}>
          {TABS.map(tab => {
            const isActive = active === tab.key;
            return (
              <button key={tab.key} onClick={() => setActive(tab.key)} style={{
                padding: '6px 14px', fontSize: '12px', background: 'transparent', border: 'none',
                borderBottom: isActive ? '2px solid #63b3ed' : '2px solid transparent',
                color: isActive ? '#f7fafc' : '#718096',
                cursor: 'pointer', whiteSpace: 'nowrap', fontWeight: isActive ? 600 : 400,
                display: 'flex', alignItems: 'center', gap: '5px',
                transition: 'color 0.15s',
              }}>
                {tab.key === 'problems' && errCount > 0 && (
                  <span style={{ fontSize: '10px', color: '#fc8181', fontWeight: 700 }}>{errCount}</span>
                )}
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: '2px', padding: '0 8px', flexShrink: 0 }}>
          {active === 'terminal' && logs.some(l => l.type === 'err') && (
            <button onClick={() => {
              const errs = logs.filter(l => l.type === 'err' || l.type === 'out').slice(-25).map(l => l.text).join('');
              window.dispatchEvent(new CustomEvent('nata-chat-prompt', { detail: `Terminal ngeluarin error ini, tolong analisis & perbaiki di project:\n\n\`\`\`\n${errs.slice(-2500)}\n\`\`\`` }));
            }} title="Kirim error ke AI buat dibenerin" style={{
              background: 'rgba(192,132,252,0.12)', border: '1px solid rgba(192,132,252,0.3)', color: '#c084fc',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '5px', fontSize: '11px', fontWeight: 700,
            }}>✨ Fix Error</button>
          )}
          {active === 'terminal' && isRunning && (
            <button onClick={onKill} title="Stop proses" style={{
              background: 'transparent', border: 'none', color: '#fc8181',
              cursor: 'pointer', display: 'flex', padding: '4px',
            }}>
              <Square size={13} />
            </button>
          )}
          {active === 'terminal' && (
            <button onClick={onClear} title="Clear terminal" style={{
              background: 'transparent', border: 'none', color: '#718096',
              cursor: 'pointer', display: 'flex', padding: '4px',
            }}>
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Sub-tab terminal (multi-terminal) */}
      {active === 'terminal' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '2px', padding: '3px 8px', borderBottom: '1px solid rgba(255,255,255,0.04)', background: '#0a0b0f', flexShrink: 0, overflowX: 'auto' }}>
          {terms.map(t => {
            const on = activeTerm === t.id;
            return (
              <div key={t.id} onClick={() => setActiveTerm(t.id)} style={{
                display: 'flex', alignItems: 'center', gap: '6px', padding: '3px 8px', borderRadius: '5px', cursor: 'pointer',
                background: on ? 'rgba(99,179,237,0.15)' : 'transparent', color: on ? '#f7fafc' : '#718096', fontSize: '11px', fontWeight: on ? 600 : 400, whiteSpace: 'nowrap',
              }}>
                <Terminal size={11} /> {t.label}
                {t.id !== 'main' && (
                  <span onClick={(e) => { e.stopPropagation(); closeTerm(t.id); }} style={{ display: 'flex', color: '#718096' }}><Square size={9} /></span>
                )}
              </div>
            );
          })}
          <button onClick={addTerm} title="Terminal baru" style={{ background: 'transparent', border: 'none', color: '#718096', cursor: 'pointer', display: 'flex', padding: '3px', borderRadius: '4px' }}>＋</button>
        </div>
      )}

      {/* Panel content */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {active === 'terminal'  && activeTerm === 'main' && <TerminalTab logs={logs} isRunning={isRunning} onRunCommand={onRunCommand} currentPath={currentPath} sysUser={sysUser} sysHost={sysHost} activeProcessId={activeProcessId} />}
        {active === 'terminal'  && activeTerm !== 'main' && terms.filter(t => t.id !== 'main').map(t => (
          <div key={t.id} style={{ flex: 1, display: activeTerm === t.id ? 'flex' : 'none', flexDirection: 'column', overflow: 'hidden' }}>
            <SelfTerminal currentPath={currentPath} sysUser={sysUser} sysHost={sysHost} />
          </div>
        ))}
        {active === 'problems'  && <ProblemsPanel diagnostics={diagnostics} isChecking={isCheckingDiagnostics} onRunDiagnostics={onRunDiagnostics} onOpenProblem={onOpenProblem} />}
        {active === 'output'    && <OutputPanel />}
        {active === 'debug'     && <DebugPanel onRunCommand={onRunCommand} currentPath={currentPath} />}
        {active === 'ports'     && <PortsPanel />}
      </div>
    </div>
  );
}
