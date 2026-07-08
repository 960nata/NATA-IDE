import React, { useEffect, useRef } from 'react';
import { Terminal, Trash2, XCircle } from 'lucide-react';

export default function TerminalPanel({ logs, isRunning, onKill, onClear }) {
  const terminalEndRef = useRef(null);

  // Auto scroll to bottom
  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  return (
    <div style={{
      height: '240px',
      borderTop: '1px solid var(--border-color)',
      background: '#07080c',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)'
    }}>
      {/* Terminal Title Bar */}
      <div style={{
        padding: '8px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'rgba(17, 19, 28, 0.5)',
        borderBottom: '1px solid var(--border-color)',
        userSelect: 'none'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
          <Terminal size={14} style={{ color: isRunning ? 'var(--accent-cyan)' : 'var(--text-secondary)' }} />
          <span style={{ 
            fontWeight: 700, 
            color: isRunning ? 'var(--accent-cyan)' : 'var(--text-secondary)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}>
            Terminal Output
          </span>
          {isRunning && (
            <span style={{
              fontSize: '10px',
              backgroundColor: 'rgba(0, 245, 255, 0.1)',
              color: 'var(--accent-cyan)',
              border: '1px solid rgba(0, 245, 255, 0.2)',
              borderRadius: '4px',
              padding: '2px 6px',
              animation: 'pulse 1.5s infinite'
            }}>
              RUNNING
            </span>
          )}
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          {isRunning && (
            <button
              onClick={onKill}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                background: 'rgba(255, 0, 127, 0.1)',
                border: '1px solid rgba(255, 0, 127, 0.3)',
                borderRadius: '4px',
                color: 'var(--accent-magenta)',
                padding: '4px 8px',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 0, 127, 0.2)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 0, 127, 0.1)'}
            >
              <XCircle size={12} />
              Batal (Kill)
            </button>
          )}
          <button
            onClick={onClear}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              background: 'transparent',
              border: '1px solid var(--border-color)',
              borderRadius: '4px',
              color: 'var(--text-secondary)',
              padding: '4px 8px',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--text-muted)'}
            onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border-color)'}
          >
            <Trash2 size={12} />
            Bersihkan
          </button>
        </div>
      </div>

      {/* Terminal Content Screen */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '12px 16px',
        fontSize: '13px',
        lineHeight: '1.5',
        color: '#f8f8f2'
      }}>
        {logs.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: '12px', fontStyle: 'italic' }}>
            Belum ada perintah yang dijalankan.
          </div>
        ) : (
          <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
            {logs.map((log, idx) => (
              <div 
                key={idx} 
                style={{ 
                  color: log.type === 'err' ? 'var(--accent-magenta)' : log.type === 'system' ? 'var(--accent-gemma)' : '#a6e22e',
                  marginBottom: '2px'
                }}
              >
                {log.text}
              </div>
            ))}
            <div ref={terminalEndRef} />
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0% { opacity: 0.6; }
          50% { opacity: 1; }
          100% { opacity: 0.6; }
        }
      `}</style>
    </div>
  );
}
