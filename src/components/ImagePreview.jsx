import React, { useState, useEffect } from 'react';
import { Image as ImageIcon, AlertCircle } from 'lucide-react';

export default function ImagePreview({ filePath }) {
  const [dataUrl, setDataUrl] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    setDataUrl(null);
    setError(null);
    window.electronAPI.readImage(filePath).then(res => {
      if (!active) return;
      if (res.success) setDataUrl(res.dataUrl);
      else setError(res.error);
    });
    return () => { active = false; };
  }, [filePath]);

  const fileName = filePath.split('/').pop();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-secondary)' }}>
      {/* Header */}
      <div style={{
        padding: '8px 14px', borderBottom: '1px solid var(--border-color)',
        display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-secondary)'
      }}>
        <ImageIcon size={14} style={{ color: 'var(--accent-cyan)' }} />
        <span style={{ fontWeight: 600 }}>{fileName}</span>
        <span style={{ color: 'var(--text-muted)' }}>· Preview Gambar</span>
      </div>

      {/* Body */}
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px', overflow: 'auto',
        backgroundImage: 'linear-gradient(45deg, rgba(255,255,255,0.02) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.02) 75%), linear-gradient(45deg, rgba(255,255,255,0.02) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.02) 75%)',
        backgroundSize: '24px 24px', backgroundPosition: '0 0, 12px 12px'
      }}>
        {error ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', color: 'var(--accent-magenta)' }}>
            <AlertCircle size={28} />
            <span style={{ fontSize: '13px' }}>Gagal memuat gambar: {error}</span>
          </div>
        ) : dataUrl ? (
          <img src={dataUrl} alt={fileName} style={{
            maxWidth: '100%', maxHeight: '100%', objectFit: 'contain',
            borderRadius: '8px', boxShadow: '0 8px 30px rgba(0,0,0,0.5)'
          }} />
        ) : (
          <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Memuat gambar...</span>
        )}
      </div>
    </div>
  );
}
