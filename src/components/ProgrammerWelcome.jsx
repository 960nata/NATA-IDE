import React, { useState } from 'react';

const RECENT_KEY = 'nata.recentWorkspaces';

export function getRecentWorkspaces() {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); } catch { return []; }
}
export function pushRecentWorkspace(path) {
  if (!path) return;
  const list = getRecentWorkspaces().filter(p => p !== path);
  list.unshift(path);
  localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 8)));
}

const shortPath = (p) => p.replace(/^\/Users\/[^/]+/, '~');
const baseName = (p) => p.replace(/\/$/, '').split('/').pop() || p;

export default function ProgrammerWelcome({ onOpenFolder }) {
  const [recent, setRecent] = useState(getRecentWorkspaces());
  const [cloning, setCloning] = useState(false);
  const [cloneUrl, setCloneUrl] = useState('');
  const [busy, setBusy] = useState('');

  const handleOpen = async () => {
    const res = await window.electronAPI.openFolder();
    if (!res.canceled && res.path) onOpenFolder(res.path);
  };

  const handleClone = async () => {
    const url = cloneUrl.trim();
    if (!url) return;
    const dest = await window.electronAPI.openFolder(); // pilih folder tujuan
    if (dest.canceled || !dest.path) return;
    setBusy('Cloning...');
    const res = await window.electronAPI.cloneRepo(url, dest.path);
    setBusy('');
    if (res.success) onOpenFolder(res.path);
    else alert('Gagal clone: ' + res.error);
  };

  const removeRecent = (e, path) => {
    e.stopPropagation();
    const list = getRecentWorkspaces().filter(p => p !== path);
    localStorage.setItem(RECENT_KEY, JSON.stringify(list));
    setRecent(list);
  };

  return (
    <div style={{
      flex: 1, display: 'flex', alignItems: 'center', justifyCenter: 'center', overflowY: 'auto',
      backgroundImage: 'linear-gradient(rgba(255,255,255,.018) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.018) 1px,transparent 1px)',
      backgroundSize: '38px 38px',
      backgroundPosition: 'center',
      minHeight: '100%'
    }}>
      <div style={{ width: '100%', maxWidth: '440px', padding: '32px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', margin: 'auto' }}>
        
        {/* Icon / Logo */}
        <div style={{
          width: '72px', height: '72px', borderRadius: '20px',
          background: 'linear-gradient(140deg, #6c3fff 0%, #2e90ff 60%, #22d3ee 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 0 1px rgba(255,255,255,.1), 0 16px 40px rgba(46,144,255,.35)',
          marginBottom: '18px'
        }}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="4" y="4" width="16" height="16" rx="2" />
            <path d="M9 9h6M9 12h6M9 15h4" />
          </svg>
        </div>

        {/* Title & Subtitle */}
        <div style={{ fontWeight: 800, fontSize: '26px', letterSpacing: '-.6px', color: '#eef2f8', marginBottom: '5px' }}>Nata IDE</div>
        <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '12px', color: '#566173', marginBottom: '32px' }}>Programmer · AI lokal</div>

        {/* Action Buttons */}
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '32px' }}>
          <button 
            onClick={handleOpen}
            style={{
              width: '100%', padding: '13px 20px', borderRadius: '10px',
              background: 'linear-gradient(100deg, #6c3fff, #2e90ff)', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
              fontFamily: '"Outfit", sans-serif', fontWeight: 600, fontSize: '14px', color: '#fff',
              boxShadow: '0 6px 24px rgba(46,144,255,.35)', transition: 'opacity .15s'
            }}
            onMouseEnter={e => e.currentTarget.style.opacity = 0.85}
            onMouseLeave={e => e.currentTarget.style.opacity = 1}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
            Open Folder
          </button>

          {!cloning ? (
            <button 
              onClick={() => setCloning(true)}
              style={{
                width: '100%', padding: '13px 20px', borderRadius: '10px',
                background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                fontFamily: '"Outfit", sans-serif', fontWeight: 600, fontSize: '14px', color: '#c5cfe0',
                transition: 'all .15s'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = 'rgba(77,159,255,.4)';
                e.currentTarget.style.background = 'rgba(77,159,255,.08)';
                e.currentTarget.style.color = '#eef2f8';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'rgba(255,255,255,.1)';
                e.currentTarget.style.background = 'rgba(255,255,255,.05)';
                e.currentTarget.style.color = '#c5cfe0';
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="18" r="3" />
                <circle cx="6" cy="6" r="3" />
                <circle cx="18" cy="6" r="3" />
                <path d="M18 9v1a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V9" />
                <path d="M12 12v3" />
              </svg>
              Clone Repository
            </button>
          ) : (
            <div style={{ display: 'flex', gap: '6px', width: '100%' }}>
              <input
                autoFocus value={cloneUrl} onChange={(e) => setCloneUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleClone()}
                placeholder="https://github.com/user/repo.git"
                style={{
                  flex: 1, padding: '10px 12px', borderRadius: '8px',
                  background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.09)',
                  color: '#eef2f8', fontFamily: '"Outfit", sans-serif', fontSize: '13px', outline: 'none'
                }}
              />
              <button 
                onClick={handleClone} 
                disabled={!!busy} 
                style={{
                  padding: '0 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600,
                  background: 'linear-gradient(100deg, #6c3fff, #2e90ff)', border: 'none', color: '#fff',
                  cursor: 'pointer'
                }}
              >
                {busy || 'Clone'}
              </button>
            </div>
          )}
        </div>

        {/* Recent workspaces */}
        {recent.length > 0 && (
          <div style={{ width: '100%' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '.6px', textTransform: 'uppercase', color: '#566173', marginBottom: '12px' }}>
              Workspaces
            </div>
            <div style={{ display: 'flex', flexDir: 'column', gap: '8px', flexDirection: 'column' }}>
              {recent.map((p) => (
                <div 
                  key={p} 
                  onClick={() => onOpenFolder(p)} 
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '11px 14px', borderRadius: '10px', background: 'rgba(255,255,255,.04)',
                    border: '1px solid rgba(255,255,255,.07)', cursor: 'pointer', transition: 'all .15s'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = 'rgba(77,159,255,.35)';
                    e.currentTarget.style.background = 'rgba(77,159,255,.07)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,.07)';
                    e.currentTarget.style.background = 'rgba(255,255,255,.04)';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                    <div style={{
                      width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(77,159,255,.12)',
                      border: '1px solid rgba(77,159,255,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4d9fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                      </svg>
                    </div>
                    <div style={{ overflow: 'hidden' }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#eef2f8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {baseName(p)}
                      </div>
                      <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '10px', color: '#566173', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {shortPath(p)}
                      </div>
                    </div>
                  </div>
                  <button 
                    onClick={(e) => removeRecent(e, p)} 
                    title="Hapus dari daftar" 
                    style={{
                      width: '22px', height: '22px', borderRadius: '5px', background: 'transparent',
                      border: 'none', color: '#566173', cursor: 'pointer', fontSize: '14px',
                      display: 'flex', alignItems: 'center', justifyCenter: 'center', transition: 'all .15s',
                      flexShrink: 0
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = 'rgba(255, 80, 80, 0.12)';
                      e.currentTarget.style.color = '#ff6060';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = '#566173';
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

