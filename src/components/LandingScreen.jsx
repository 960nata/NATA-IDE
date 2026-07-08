import React from 'react';

export const MODES = [
  {
    key: 'cowork',
    tag: '01 · agent',
    title: 'Nata Cowork',
    desc: 'Asisten serba-bisa ala Cowork: kode, dokumen, gambar, web — dia pilih tool sendiri.',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4d9fff" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.2 2.2M16.9 16.9l2.2 2.2M4.9 19.1l2.2-2.2M16.9 7.1l2.2-2.2" />
      </svg>
    )
  },
  {
    key: 'programmer',
    tag: '02 · code',
    title: 'Programmer IDE',
    desc: 'Editor kode + terminal + AI. Nulis & jalanin kode langsung di Mac kamu.',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4d9fff" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="16 18 22 12 16 6" />
        <polyline points="8 6 2 12 8 18" />
      </svg>
    )
  },
  {
    key: 'image',
    tag: '03 · image',
    title: 'Studio Gambar',
    desc: 'Resize, konversi format, sampai baca teks dari gambar (OCR).',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4d9fff" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="3" />
        <circle cx="9" cy="9" r="2" />
        <path d="m21 15-5-5L5 21" />
      </svg>
    )
  },
  {
    key: 'scrape',
    tag: '04 · web',
    title: 'Web Scraper',
    desc: 'Ambil & rangkum data dari internet otomatis.',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4d9fff" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" />
      </svg>
    )
  },
  {
    key: 'docs',
    tag: '05 · docs',
    title: 'Generator Dokumen',
    desc: 'Word, PDF, & PowerPoint dari satu perintah.',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4d9fff" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="8" y1="13" x2="16" y2="13" />
        <line x1="8" y1="17" x2="14" y2="17" />
      </svg>
    )
  },
  // Mode Alarm DIHAPUS — ala Cowork: alarm/notify jadi tool yang bisa dipanggil
  // dari mode mana aja (```tool:alarm), bukan mode terpisah sendiri.
  {
    key: 'terminal',
    tag: '06 · shell',
    title: 'Terminal AI',
    desc: 'Tanya apa aja ke AI lokal langsung dari command line.',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4d9fff" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="4 17 10 11 4 5" />
        <line x1="12" y1="19" x2="20" y2="19" />
      </svg>
    )
  }
];

export default function LandingScreen({ onEnter }) {
  const [hoveredKey, setHoveredKey] = React.useState(null);

  return (
    <div style={{
      position: 'relative',
      minHeight: '100vh',
      width: '100%',
      backgroundColor: '#07090d',
      backgroundImage: 'linear-gradient(rgba(255,255,255,.022) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.022) 1px, transparent 1px)',
      backgroundSize: '42px 42px',
      padding: '56px 32px 72px',
      overflowY: 'auto'
    }}>
      {/* top radial gradient glow */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: '340px',
        background: 'radial-gradient(80% 100% at 50% 0%, rgba(45,140,255,.16) 0%, transparent 70%)',
        pointerEvents: 'none',
        zIndex: 1
      }}></div>

      <div style={{ position: 'relative', zIndex: 2, maxWidth: '1080px', margin: '0 auto' }}>
        
        {/* Top bar */}
        <div style={{ display: 'flex', alignContent: 'center', justifyContent: 'space-between', marginBottom: '56px', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '13px' }}>
            <div style={{
              width: '40px', height: '40px', borderRadius: '10px',
              background: '#0d1117', border: '1px solid rgba(45,140,255,.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 24px rgba(45,140,255,.25)'
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4d9fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="4 17 10 11 4 5" />
                <line x1="12" y1="19" x2="20" y2="19" />
              </svg>
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '18px', letterSpacing: '-.4px', color: '#f0f3f8', lineHeight: 1 }}>Nata IDE</div>
              <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '11px', color: '#566173', marginTop: '3px' }}>v2.4.0 · local-first</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 13px', borderRadius: '8px', background: 'rgba(45,140,255,.08)', border: '1px solid rgba(45,140,255,.2)' }}>
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#2fe08a', boxShadow: '0 0 8px #2fe08a' }}></span>
            <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '12px', color: '#9fb2c9' }}>qwen2.5-coder:3b online</span>
          </div>
        </div>

        {/* Heading prompt */}
        <div style={{ marginBottom: '44px' }}>
          <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '13px', color: '#4d9fff', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ color: '#566173' }}>~/nata</span>
            <span style={{ color: '#566173' }}>$</span>
            <span>select --mode</span>
            <span style={{ display: 'inline-block', width: '8px', height: '15px', background: '#4d9fff', animation: 'blink 1.1s step-end infinite' }}></span>
          </div>
          <h1 style={{ fontWeight: 800, fontSize: '42px', letterSpacing: '-1.5px', color: '#f4f7fb', marginBottom: '14px', lineHeight: 1.1 }}>
            Mau ngapain hari ini?
          </h1>
          <p style={{ fontSize: '15.5px', color: '#7e8a9c', maxWidth: '540px', lineHeight: 1.6 }}>
            Pilih satu mode buat mulai. Tiap mode punya workspace sendiri, ditenagai AI lokal yang ikut tidur biar baterai &amp; RAM hemat.
          </p>
        </div>

        {/* Grid modes */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '14px'
        }}>
          {MODES.map((m) => {
            const isHovered = hoveredKey === m.key;
            return (
              <button
                key={m.key}
                onClick={() => onEnter(m.key)}
                onMouseEnter={() => setHoveredKey(m.key)}
                onMouseLeave={() => setHoveredKey(null)}
                style={{
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  textAlign: 'left',
                  padding: '20px',
                  borderRadius: '13px',
                  background: isHovered ? '#0d141d' : '#0a0f16',
                  border: isHovered ? '1px solid rgba(77,159,255,.55)' : '1px solid rgba(255,255,255,.07)',
                  transition: 'border-color .2s ease, background .2s ease',
                  minHeight: '178px',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  color: 'inherit',
                  fontFamily: 'inherit',
                  outline: 'none'
                }}
              >
                <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', borderRadius: '13px', pointerEvents: 'none' }}>
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: '1px',
                    background: 'linear-gradient(90deg,transparent,rgba(77,159,255,.5),transparent)',
                    opacity: isHovered ? 1 : 0,
                    animation: isHovered ? 'scan 2s linear infinite' : 'none'
                  }}></div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '22px', justifyContent: 'space-between', width: '100%' }}>
                  <div style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '11px',
                    background: '#11161f',
                    border: '1px solid rgba(77,159,255,.22)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    {m.icon}
                  </div>
                  <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '11px', color: '#475061' }}>
                    {m.tag}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '7px' }}>
                  <span style={{ fontWeight: 700, fontSize: '16px', letterSpacing: '-.3px', color: '#eef2f8' }}>
                    {m.title}
                  </span>
                </div>
                <p style={{ fontSize: '13px', color: '#7e8a9c', margin: 0, lineHeight: 1.55 }}>
                  {m.desc}
                </p>
                <div style={{ marginTop: 'auto', paddingTop: '20px', display: 'flex', alignItems: 'center', gap: '6px', fontFamily: '"JetBrains Mono", monospace', fontSize: '12px', color: '#4d9fff' }}>
                  <span>buka</span>
                  <span style={{ fontWeight: 600 }}>→</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div style={{ marginTop: '36px', display: 'flex', alignItems: 'center', gap: '10px', fontFamily: '"JetBrains Mono", monospace', fontSize: '12px', color: '#4a5365' }}>
          <span>Ditenagai Ollama</span>
          <span style={{ opacity: .4 }}>·</span>
          <span>AI nyala pas dipakai, mati pas app ditutup</span>
          <span style={{ opacity: .4 }}>·</span>
          <span style={{ color: '#2fe08a' }}>100% lokal, no cloud</span>
        </div>

      </div>

      <style>{`
        @keyframes blink { 0%, 49% { opacity: 1; } 50%, 100% { opacity: 0; } }
        @keyframes scan { 0% { transform: translateY(-100px); } 100% { transform: translateY(200px); } }
      `}</style>
    </div>
  );
}
