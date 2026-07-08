import React from 'react';
import { X, Trash2, CheckCheck } from 'lucide-react';

export default function NotificationCenter({ 
  open, 
  onClose, 
  notifications, 
  onClear, 
  onMarkAllRead 
}) {
  if (!open) return null;

  const color = { 
    success: '#34d399', 
    error: '#f87171', 
    info: '#60a5fa' 
  };

  return (
    <>
      {/* Click-away overlay wrapper */}
      <div 
        onClick={onClose} 
        style={{ 
          position: 'fixed', 
          inset: 0, 
          zIndex: 1900,
          background: 'transparent'
        }} 
      />

      {/* Floating Card */}
      <div 
        className="glass-panel"
        style={{ 
          position: 'fixed', 
          bottom: '30px', 
          right: '12px', 
          width: '360px', 
          maxHeight: '400px', 
          zIndex: 1901, 
          display: 'flex', 
          flexDirection: 'column',
          boxShadow: '0 12px 32px rgba(0, 0, 0, 0.6)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          animation: 'slideUpNotif 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          padding: '12px 14px', 
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
          background: 'rgba(9, 10, 15, 0.6)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '13px' }}>🔔</span>
            <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#fff' }}>Pusat Notifikasi</span>
            {notifications.some(n => !n.read) && (
              <span style={{ 
                background: 'var(--accent-magenta)', 
                color: '#fff', 
                fontSize: '9px', 
                fontWeight: 800, 
                padding: '1px 6px', 
                borderRadius: '10px'
              }}>
                Baru
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {notifications.length > 0 && (
              <>
                <button 
                  onClick={onMarkAllRead} 
                  title="Tandai semua dibaca"
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px', borderRadius: '4px' }}
                  onMouseEnter={e => e.currentTarget.style.color = '#fff'}
                  onMouseLeave={e => e.currentTarget.style.color = 'var(--text-secondary)'}
                >
                  <CheckCheck size={13} />
                </button>
                <button 
                  onClick={onClear} 
                  title="Bersihkan semua"
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px', borderRadius: '4px' }}
                  onMouseEnter={e => e.currentTarget.style.color = '#f87171'}
                  onMouseLeave={e => e.currentTarget.style.color = 'var(--text-secondary)'}
                >
                  <Trash2 size={13} />
                </button>
              </>
            )}
            <button 
              onClick={onClose} 
              style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px', borderRadius: '4px' }}
              onMouseEnter={e => e.currentTarget.style.color = '#fff'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
            >
              <X size={13} />
            </button>
          </div>
        </div>

        {/* Content list */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '8px 0' }}>
          {notifications.length === 0 ? (
            <div style={{ padding: '30px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
              Tidak ada notifikasi masuk
            </div>
          ) : (
            notifications.map(n => (
              <div 
                key={n.id} 
                style={{ 
                  padding: '10px 14px', 
                  borderBottom: '1px solid rgba(255,255,255,0.03)',
                  background: n.read ? 'transparent' : 'rgba(138, 43, 226, 0.04)',
                  display: 'flex',
                  gap: '10px',
                  alignItems: 'flex-start',
                  transition: 'background 0.2s'
                }}
              >
                {/* Indicator dot */}
                <div style={{ 
                  width: '6px', 
                  height: '6px', 
                  borderRadius: '50%', 
                  background: color[n.type] || color.info,
                  marginTop: '6px',
                  flexShrink: 0
                }} />

                <div style={{ flex: 1, minWidth: 0 }}>
                  <p className="sel" style={{ 
                    margin: 0, 
                    fontSize: '12px', 
                    color: n.read ? 'var(--text-secondary)' : '#fff',
                    lineHeight: '1.4',
                    wordBreak: 'break-word'
                  }}>
                    {n.message}
                  </p>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
                    {n.time}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      <style>{`
        @keyframes slideUpNotif {
          from { transform: translateY(12px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </>
  );
}
