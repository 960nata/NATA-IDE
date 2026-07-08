import React, { useState } from 'react';
import { Sparkles, ArrowRight, ArrowLeft, X } from 'lucide-react';

export default function OnboardingTour({ open, onComplete, sidebarWidth = 250, chatWidth = 420 }) {
  if (!open) return null;

  const [step, setStep] = useState(0);

  const steps = [
    {
      title: 'Selamat Datang di Nata IDE! ⌁',
      desc: 'Nata IDE adalah editor kode lokal cerdas bertenaga AI lokal (Ollama). Mari kita lihat tur singkat 5 langkah agar kamu bisa menggunakannya secara maksimal.',
      buttonText: 'Mulai Tur',
      position: { top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '420px' }
    },
    {
      title: 'Aktivitas & Navigasi Berkas',
      desc: 'Di panel kiri, kamu bisa menjelajahi berkas proyek, melakukan pencarian global, mengelola Git Branch/Stash di Source Control, dan mengaktifkan Skill AI untuk melatih model.',
      buttonText: 'Lanjut',
      position: { top: '160px', left: `${sidebarWidth + 70}px`, width: '340px' }
    },
    {
      title: 'Editor Berkas & Split-Screen',
      desc: 'Editor Monaco mendukung drag-and-drop untuk mengatur ulang tab, word-wrap otomatis (Alt+Z), format otomatis saat menyimpan file (Format on Save), dan Inline Git Blame untuk melihat riwayat baris.',
      buttonText: 'Lanjut',
      position: { top: '160px', left: '50%', transform: 'translateX(-50%)', width: '380px' }
    },
    {
      title: 'Asisten Obrolan AI (Gemma)',
      desc: 'Di sisi kanan, kamu dapat berdiskusi dengan AI. Ketik "@" untuk menautkan berkas ke dalam konteks, gunakan mikrofon untuk mengetik via suara, dan manfaatkan tombol "↩ Undo" jika ingin membatalkan perubahan kode dari AI.',
      buttonText: 'Lanjut',
      position: { top: '160px', right: `${chatWidth + 20}px`, width: '360px' }
    },
    {
      title: 'Terminal & Masalah (Diagnostics)',
      desc: 'Panel bawah menampung multi-terminal yang bisa dijalankan secara paralel. Ada juga tab "Problems" yang berisi visualisasi error/warning linter (ESLint & TypeScript) secara real-time.',
      buttonText: 'Lanjut',
      position: { bottom: '260px', left: '80px', width: '380px' }
    },
    {
      title: 'Palet Perintah & Pintasan Keyboard',
      desc: 'Tekan ⌘+K atau ⌘+Shift+P untuk memunculkan Palet Perintah. Di sini kamu bisa mencari perintah, format kode, mengganti tema editor, hingga memeriksa pembaruan Nata IDE.',
      buttonText: 'Selesai & Mulai Coding!',
      position: { top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '440px' }
    }
  ];

  // Dynamic calculations for spotlights matching the layout positions
  const spotlights = [
    null, // Welcome (centered)
    { top: '38px', left: 0, width: `${sidebarWidth + 48}px`, height: 'calc(100vh - 62px)' }, // Sidebar + Activity Bar
    { top: '38px', left: `${sidebarWidth + 48}px`, width: `calc(100vw - ${sidebarWidth + 48 + chatWidth}px)`, height: 'calc(100vh - 286px)' }, // Editor area
    { top: '38px', right: 0, width: `${chatWidth}px`, height: 'calc(100vh - 62px)' }, // AI Chat panel
    { bottom: '24px', left: '48px', width: `calc(100vw - ${48 + chatWidth}px)`, height: '220px' }, // Terminal / Bottom Panel
    null // Command palette (centered)
  ];

  const currentStep = steps[step];
  const currentSpotlight = spotlights[step];

  const handleNext = () => {
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      onComplete();
    }
  };

  const handlePrev = () => {
    if (step > 0) {
      setStep(step - 1);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 4000, overflow: 'hidden' }}>
      {/* Dynamic Spotlight */}
      <div 
        style={{
          position: 'fixed',
          top: currentSpotlight ? currentSpotlight.top : '50%',
          left: currentSpotlight ? currentSpotlight.left : '50%',
          right: currentSpotlight ? currentSpotlight.right : 'auto',
          bottom: currentSpotlight ? currentSpotlight.bottom : 'auto',
          width: currentSpotlight ? currentSpotlight.width : '0px',
          height: currentSpotlight ? currentSpotlight.height : '0px',
          border: currentSpotlight ? '2px dashed var(--accent-cyan)' : 'none',
          boxShadow: '0 0 0 9999px rgba(5, 5, 8, 0.75)',
          backdropFilter: 'blur(1.5px)',
          borderRadius: '12px',
          pointerEvents: 'none',
          zIndex: 3999,
          transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
        }} 
      />

      {/* Interactive Card */}
      <div 
        className="glass-panel"
        style={{
          position: 'fixed',
          zIndex: 4001,
          padding: '24px',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
          ...currentStep.position
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={16} style={{ color: 'var(--accent-cyan)' }} />
            <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 800, color: '#fff' }}>
              {currentStep.title}
            </h3>
          </div>
          <button 
            onClick={onComplete} 
            title="Lewati Tur"
            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}
            onMouseEnter={e => e.currentTarget.style.color = '#fff'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
          >
            <X size={15} />
          </button>
        </div>

        {/* Description */}
        <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
          {currentStep.desc}
        </p>

        {/* Footer Navigation */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
          {/* Step dots */}
          <div style={{ display: 'flex', gap: '5px' }}>
            {steps.map((_, idx) => (
              <div 
                key={idx} 
                onClick={() => setStep(idx)}
                style={{ 
                  width: idx === step ? '16px' : '6px', 
                  height: '6px', 
                  borderRadius: '100px', 
                  background: idx === step ? 'var(--accent-cyan)' : 'var(--text-muted)',
                  cursor: 'pointer',
                  transition: 'all 0.25s' 
                }} 
              />
            ))}
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '8px' }}>
            {step > 0 && (
              <button 
                onClick={handlePrev} 
                style={{ 
                  background: 'rgba(255, 255, 255, 0.05)', 
                  border: '1px solid rgba(255, 255, 255, 0.1)', 
                  color: 'var(--text-primary)', 
                  borderRadius: '6px', 
                  padding: '5px 12px', 
                  fontSize: '11.5px', 
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <ArrowLeft size={12} /> Kembali
              </button>
            )}
            <button 
              onClick={handleNext} 
              className="glow-btn"
              style={{ 
                borderRadius: '6px', 
                padding: '6px 14px', 
                fontSize: '11.5px', 
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              {currentStep.buttonText} {step < steps.length - 1 && <ArrowRight size={12} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
