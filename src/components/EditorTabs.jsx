import React, { useState } from 'react';
import { X, Plus } from 'lucide-react';

const EXT_COLOR = {
  js:'#f7df1e',jsx:'#61dafb',ts:'#3178c6',tsx:'#3178c6',
  html:'#e44d26',css:'#264de4',scss:'#cc6699',json:'#fbc02d',
  md:'#a0c4ff',py:'#3572A5',sh:'#89e051',svg:'#ff9800',
  png:'#66bb6a',jpg:'#66bb6a',jpeg:'#66bb6a',webp:'#66bb6a',
  vue:'#41b883',dart:'#00b4ab',swift:'#ff6b00',kt:'#a97bff',
};
function tabColor(name) {
  return EXT_COLOR[(name||'').split('.').pop().toLowerCase()] || '#aaa';
}
function baseName(p) { return (p||'').split('/').pop() || 'Untitled'; }

export default function EditorTabs({ tabs, activeTab, onSelect, onClose, onNew, onReorder, workspaceRoot }) {
  const [dragOverIdx, setDragOverIdx] = useState(null);
  const [menu, setMenu] = useState(null); // {x, y, path} — context menu klik kanan tab

  if (!tabs || tabs.length === 0) return null;

  const relPath = (p) => workspaceRoot && p.startsWith(workspaceRoot + '/') ? p.slice(workspaceRoot.length + 1) : p;
  const menuActions = menu ? [
    ['Tutup', () => onClose(menu.path)],
    ['Tutup Lainnya', () => tabs.filter(t => t.path !== menu.path).forEach(t => onClose(t.path))],
    ['Tutup Semua', () => tabs.forEach(t => onClose(t.path))],
    null,
    ['Copy Path', () => navigator.clipboard.writeText(menu.path)],
    ['Copy Path Relatif', () => navigator.clipboard.writeText(relPath(menu.path))],
    ['Reveal di Finder', () => window.electronAPI.revealPath(menu.path)],
    null,
    ['✨ Review file ini (AI)', () => window.dispatchEvent(new CustomEvent('nata-chat-prompt', { detail: `Review file @${relPath(menu.path)} — cek bug, kode jelek, dan saran perbaikan. Singkat & konkret.` }))],
    ['✨ Jelasin file ini (AI)', () => window.dispatchEvent(new CustomEvent('nata-chat-prompt', { detail: `Jelasin isi & alur file @${relPath(menu.path)} secara singkat dalam bahasa Indonesia.` }))],
  ] : [];

  return (
    <div style={{
      display: 'flex', alignItems: 'center', background: 'rgba(7, 8, 12, 0.7)',
      borderBottom: '1px solid var(--border-color)', minHeight: '36px',
      overflowX: 'auto', flexShrink: 0
    }}>
      {tabs.map((tab, idx) => {
        const active = tab.path === activeTab;
        const name = baseName(tab.path);
        const color = tabColor(name);
        const isDragOver = dragOverIdx === idx;
        return (
          <div
            key={tab.path}
            onClick={() => onSelect(tab.path)}
            onContextMenu={(e) => { e.preventDefault(); setMenu({ x: e.clientX, y: e.clientY, path: tab.path }); }}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.effectAllowed = 'move';
              e.dataTransfer.setData('text/plain', idx.toString());
            }}
            onDragOver={(e) => {
              e.preventDefault();
              if (dragOverIdx !== idx) setDragOverIdx(idx);
            }}
            onDragLeave={() => {
              if (dragOverIdx === idx) setDragOverIdx(null);
            }}
            onDrop={(e) => {
              e.preventDefault();
              setDragOverIdx(null);
              const fromIdx = parseInt(e.dataTransfer.getData('text/plain'), 10);
              if (!isNaN(fromIdx) && fromIdx !== idx && onReorder) {
                onReorder(fromIdx, idx);
              }
            }}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '0 12px 0 10px', height: '36px', flexShrink: 0,
              cursor: 'pointer', userSelect: 'none',
              background: active ? 'rgba(255,255,255,0.06)' : 'transparent',
              borderRight: '1px solid var(--border-color)',
              borderBottom: active ? `2px solid ${color}` : '2px solid transparent',
              boxShadow: isDragOver ? 'inset 4px 0 0 var(--accent-blue, #2196f3)' : 'none',
              color: active ? 'var(--text-primary)' : 'var(--text-muted)',
              transition: 'all 0.15s',
              position: 'relative'
            }}
            onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
            onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; }}
          >
            {/* dot merah kalau dirty */}
            {tab.dirty && (
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent-magenta)', flexShrink: 0 }} />
            )}
            <span style={{ fontSize: '12px', fontWeight: active ? 600 : 400, maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {name}
            </span>
            <button
              onClick={(e) => { e.stopPropagation(); onClose(tab.path); }}
              title="Tutup tab"
              style={{
                width: 16, height: 16, borderRadius: '3px', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: 'var(--text-muted)', padding: 0
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#fff'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
            >
              <X size={11} />
            </button>
          </div>
        );
      })}

      {/* Tombol tab baru */}
      <button
        onClick={onNew}
        title="Tab baru"
        style={{
          width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'transparent', border: 'none', cursor: 'pointer',
          color: 'var(--text-muted)', flexShrink: 0
        }}
        onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
      >
        <Plus size={15} />
      </button>

      {/* Context menu klik kanan tab — ala VS Code */}
      {menu && (
        <>
          <div onClick={() => setMenu(null)} onContextMenu={(e) => { e.preventDefault(); setMenu(null); }} style={{ position: 'fixed', inset: 0, zIndex: 98 }} />
          <div style={{
            position: 'fixed', top: Math.min(menu.y, window.innerHeight - 300), left: Math.min(menu.x, window.innerWidth - 220),
            zIndex: 99, background: '#1c1d24', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px',
            boxShadow: '0 8px 30px rgba(0,0,0,0.5)', padding: '4px', minWidth: '200px',
          }}>
            <div style={{ padding: '4px 10px', fontSize: '10.5px', color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{baseName(menu.path)}</div>
            {menuActions.map((a, i) => a === null
              ? <div key={i} style={{ height: '1px', background: 'rgba(255,255,255,0.07)', margin: '4px 6px' }} />
              : <button key={i} onClick={() => { setMenu(null); a[1](); }}
                  style={{ display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none', color: '#e5e7eb', fontSize: '12px', padding: '5px 10px', borderRadius: '5px', cursor: 'pointer' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(96,165,250,0.15)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'none'}
                >{a[0]}</button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
