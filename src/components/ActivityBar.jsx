import React from 'react';
import { Files, Search, GitBranch, Play, Blocks, Settings, Zap } from 'lucide-react';

const ITEMS = [
  { key: 'explorer', icon: Files,     label: 'Explorer' },
  { key: 'search',   icon: Search,    label: 'Cari' },
  { key: 'scm',      icon: GitBranch, label: 'Source Control' },
  { key: 'skills',   icon: Zap,       label: 'Skills' },
  { key: 'run',      icon: Play,      label: 'Run & Debug' },
  { key: 'ext',      icon: Blocks,    label: 'Extensions' },
];

export default function ActivityBar({ activeView, onSelect, onSettings }) {
  const Item = ({ item }) => {
    const active = activeView === item.key;
    return (
      <button
        key={item.key}
        title={item.label}
        onClick={() => onSelect(active ? null : item.key)}
        style={{
          width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'transparent', border: 'none', cursor: 'pointer', position: 'relative',
          color: active ? 'var(--text-primary)' : 'var(--text-muted)', transition: 'color 0.15s'
        }}
        onMouseEnter={(e) => { if (!active) e.currentTarget.style.color = 'var(--text-secondary)'; }}
        onMouseLeave={(e) => { if (!active) e.currentTarget.style.color = 'var(--text-muted)'; }}
      >
        {/* garis aktif di kiri */}
        {active && (
          <span style={{
            position: 'absolute', left: 0, top: '10px', bottom: '10px', width: '2px',
            background: 'var(--accent-cyan)', borderRadius: '0 2px 2px 0'
          }} />
        )}
        <item.icon size={22} />
      </button>
    );
  };

  return (
    <div style={{
      width: '48px', height: '100%', flexShrink: 0,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between',
      background: 'rgba(7, 8, 12, 0.6)', borderRight: '1px solid var(--border-color)', paddingTop: '6px', paddingBottom: '8px'
    }}>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {ITEMS.map(item => <Item key={item.key} item={item} />)}
      </div>
      <button
        title="Pengaturan / Menu"
        onClick={onSettings}
        style={{
          width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)'
        }}
        onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
      >
        <Settings size={22} />
      </button>
    </div>
  );
}
