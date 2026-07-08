import React from 'react';
import { X } from 'lucide-react';

export default function KeyboardShortcutsModal({ open, onClose }) {
  if (!open) return null;

  const categories = [
    {
      title: 'Editor',
      shortcuts: [
        { desc: 'Simpan File Aktif (Save)', keys: ['⌘ / Ctrl', 'S'] },
        { desc: 'Toggle Word Wrap (Bungkus Baris)', keys: ['Alt / Option', 'Z'] },
        { desc: 'Format Dokumen (saat disimpan)', keys: ['Otomatis saat Save (jika aktif)'] }
      ]
    },
    {
      title: 'Navigasi & Workspace',
      shortcuts: [
        { desc: 'Cari Berkas Cepat (Quick Open)', keys: ['⌘ / Ctrl', 'P'] },
        { desc: 'Palet Perintah (Command Palette)', keys: ['⌘ / Ctrl', 'Shift', 'P', 'atau', '⌘ / Ctrl', 'K'] },
        { desc: 'Buka Kembali Tab Terakhir Ditutup', keys: ['⌘ / Ctrl', 'Shift', 'T'] },
        { desc: 'Toggle Mode Zen (Fokus Editor)', keys: ['⌘ / Ctrl', '.'] }
      ]
    },
    {
      title: 'AI & Chat Assistant',
      shortcuts: [
        { desc: 'Panggil Berkas/Folder di Chat Input', keys: ['@', 'diikuti nama file'] },
        { desc: 'Input Suara (Speech to Text)', keys: ['Klik ikon Mic di Chat'] },
        { desc: 'Batalkan Kode AI (Rollback Checkpoint)', keys: ['Klik tombol ↩ Undo di chat bubble'] }
      ]
    },
    {
      title: 'Terminal & Proses',
      shortcuts: [
        { desc: 'Toggle Panel Bawah (Terminal)', keys: ['Ctrl', '`'] },
        { desc: 'Perbaiki Error Terminal Lewat AI', keys: ['Klik tombol ✨ Fix Error di terminal'] }
      ]
    }
  ];

  return (
    <div 
      onClick={onClose} 
      style={{ 
        position: 'fixed', 
        inset: 0, 
        zIndex: 3500, 
        background: 'rgba(5, 5, 8, 0.75)', 
        backdropFilter: 'blur(8px)',
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center' 
      }}
    >
      <div 
        onClick={e => e.stopPropagation()} 
        className="glass-panel"
        style={{ 
          width: '560px', 
          maxWidth: '90vw', 
          maxHeight: '80vh', 
          padding: '24px', 
          boxShadow: '0 24px 64px rgba(0,0,0,0.8)', 
          display: 'flex', 
          flexDirection: 'column',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          animation: 'modalFadeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '18px' }}>⌨️</span>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#fff' }}>
              Referensi Pintasan Keyboard
            </h3>
          </div>
          <button 
            onClick={onClose} 
            style={{ 
              background: 'transparent', 
              border: 'none', 
              color: 'var(--text-muted)', 
              cursor: 'pointer',
              display: 'flex',
              padding: '4px',
              borderRadius: '4px',
              transition: 'background 0.2s'
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div style={{ overflowY: 'auto', flex: 1, paddingRight: '4px' }}>
          {categories.map((cat, cIdx) => (
            <div key={cIdx} style={{ marginBottom: '20px' }}>
              <h4 style={{ 
                fontSize: '11px', 
                fontWeight: 700, 
                color: 'var(--accent-cyan)', 
                textTransform: 'uppercase', 
                letterSpacing: '0.08em',
                marginBottom: '10px',
                borderBottom: '1px solid rgba(255,255,255,0.05)',
                paddingBottom: '4px'
              }}>
                {cat.title}
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {cat.shortcuts.map((sh, sIdx) => (
                  <div key={sIdx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12.5px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>{sh.desc}</span>
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: '60%' }}>
                      {sh.keys.map((k, kIdx) => {
                        const isActionText = k.length > 4 && !k.includes('⌘') && !k.includes('Ctrl') && !k.includes('Shift') && !k.includes('Alt');
                        if (isActionText) {
                          return <span key={kIdx} style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic' }}>{k}</span>;
                        }
                        if (k === 'atau') {
                          return <span key={kIdx} style={{ fontSize: '10px', color: 'var(--text-muted)' }}>atau</span>;
                        }
                        return (
                          <kbd key={kIdx} style={{
                            background: 'rgba(255, 255, 255, 0.05)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderBottomWidth: '2px',
                            borderRadius: '4px',
                            padding: '2px 6px',
                            fontSize: '10px',
                            fontFamily: '"JetBrains Mono", monospace',
                            color: '#fff',
                            fontWeight: 600,
                            boxShadow: '0 1px 2px rgba(0,0,0,0.4)'
                          }}>{k}</kbd>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ marginTop: '16px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '14px', display: 'flex', justifyContent: 'flex-end' }}>
          <button 
            onClick={onClose} 
            className="glow-btn"
            style={{ 
              padding: '6px 16px', 
              borderRadius: '6px', 
              fontSize: '12px' 
            }}
          >
            Tutup
          </button>
        </div>
      </div>
      <style>{`
        @keyframes modalFadeIn {
          from { transform: scale(0.95); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
