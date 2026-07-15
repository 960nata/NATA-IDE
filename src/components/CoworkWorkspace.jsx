import React, { useState, useEffect, useCallback } from 'react';
import { FileText, Image as ImageIcon, Globe, File, Search, Trash2, FolderOpen, ExternalLink, Copy, RefreshCw, ChevronDown, ChevronRight } from 'lucide-react';
import { toast } from '../toast';

const DOC_EXTS = ['docx', 'pdf', 'pptx', 'xlsx', 'txt', 'doc', 'csv'];
const IMG_EXTS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'];
const SCRAPE_EXTS = ['md', 'html'];
const IGNORE_PATTERNS = ['.git', 'node_modules', 'dist', 'dist-electron', 'package.json', 'package-lock.json', '.DS_Store', '.next', 'build', '.cache', '__pycache__', '.venv', 'venv'];

export default function CoworkWorkspace({ rootPath }) {
  const [files, setFiles] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [collapsed, setCollapsed] = useState({
    docs: false,
    images: false,
    scrapes: false,
    others: false,
  });

  const ext = (p) => (p || '').split('.').pop().toLowerCase();

  const fetchFiles = useCallback(async () => {
    if (!rootPath) return;
    setLoading(true);
    try {
      const res = await window.electronAPI.listFiles(rootPath);
      if (res && res.success) {
        // Filter out system and developer files
        const filtered = (res.files || []).filter(f => {
          const name = f.name;
          const parts = f.path.replace(rootPath, '').split('/');
          // Ignore if any path segment contains an ignored folder/file
          const shouldIgnore = parts.some(part => IGNORE_PATTERNS.includes(part));
          return !shouldIgnore;
        });
        setFiles(filtered);
      }
    } catch (err) {
      console.error('Error fetching files in Cowork:', err);
    } finally {
      setLoading(false);
    }
  }, [rootPath]);

  useEffect(() => {
    fetchFiles();
    
    // Auto-refresh when AI finishes a tool
    const handleToolRan = () => {
      setTimeout(fetchFiles, 500);
    };
    window.addEventListener('nata-tool-ran', handleToolRan);
    
    // Auto-refresh when workspace files are changed
    let offWatch = null;
    if (window.electronAPI.onWorkspaceChanged) {
      offWatch = window.electronAPI.onWorkspaceChanged(() => {
        fetchFiles();
      });
    }

    return () => {
      window.removeEventListener('nata-tool-ran', handleToolRan);
      if (offWatch) offWatch();
    };
  }, [fetchFiles]);

  const handleOpen = async (filePath) => {
    try {
      const res = await window.electronAPI.openExternal(`file://${filePath}`);
      if (res && res.success) {
        toast('Berkas berhasil dibuka', 'success');
      } else {
        // Fallback to reveal path
        window.electronAPI.revealPath(filePath);
        toast('Menampilkan berkas di Finder', 'info');
      }
    } catch (err) {
      window.electronAPI.revealPath(filePath);
      toast('Menampilkan berkas di Finder', 'info');
    }
  };

  const handleDelete = async (filePath, fileName) => {
    if (confirm(`Apakah Anda yakin ingin menghapus berkas "${fileName}"?`)) {
      try {
        const res = await window.electronAPI.deletePath(filePath);
        if (res && res.success) {
          toast('Berkas berhasil dihapus', 'success');
          fetchFiles();
        } else {
          toast('Gagal menghapus berkas: ' + (res?.error || 'Error'), 'error');
        }
      } catch (err) {
        toast('Gagal menghapus berkas: ' + err.message, 'error');
      }
    }
  };

  const handleCopyPath = (filePath) => {
    navigator.clipboard.writeText(filePath);
    toast('Path disalin ke clipboard', 'success');
  };

  const toggleCollapse = (cat) => {
    setCollapsed(prev => ({ ...prev, [cat]: !prev[cat] }));
  };

  // Group files into categories
  const filteredQuery = files.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()));

  const docs = filteredQuery.filter(f => DOC_EXTS.includes(ext(f.name)));
  const images = filteredQuery.filter(f => IMG_EXTS.includes(ext(f.name)));
  const scrapes = filteredQuery.filter(f => SCRAPE_EXTS.includes(ext(f.name)));
  const others = filteredQuery.filter(f => !DOC_EXTS.includes(ext(f.name)) && !IMG_EXTS.includes(ext(f.name)) && !SCRAPE_EXTS.includes(ext(f.name)));

  const renderCategoryHeader = (title, count, catKey, icon, color) => {
    const isCollapsed = collapsed[catKey];
    return (
      <div 
        onClick={() => toggleCollapse(catKey)}
        style={{
          display: 'flex', alignItems: 'center', gap: '8px', 
          padding: '8px 12px', background: 'rgba(255,255,255,0.02)', 
          border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px',
          cursor: 'pointer', userSelect: 'none', margin: '8px 0 4px 0',
          transition: 'background 0.2s'
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
        onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
      >
        {isCollapsed ? <ChevronRight size={14} style={{ color: '#718096' }} /> : <ChevronDown size={14} style={{ color: '#718096' }} />}
        <span style={{ color }}>{icon}</span>
        <span style={{ fontSize: '12px', fontWeight: 700, color: '#e2e8f0', flex: 1 }}>{title}</span>
        <span style={{ 
          fontSize: '10px', fontWeight: 700, color: '#94a3b8', 
          background: 'rgba(255,255,255,0.06)', padding: '2px 8px', 
          borderRadius: '10px' 
        }}>{count}</span>
      </div>
    );
  };

  const renderFileList = (items, categoryColor) => {
    if (items.length === 0) {
      return (
        <div style={{ padding: '8px 16px', fontSize: '11px', color: '#4a5568', fontStyle: 'italic' }}>
          Kosong
        </div>
      );
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingLeft: '8px' }}>
        {items.map(f => (
          <div 
            key={f.path}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px', 
              padding: '6px 10px', borderRadius: '6px', 
              background: 'transparent', transition: 'background 0.15s'
            }}
            className="cowork-file-item"
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div 
                onClick={() => handleOpen(f.path)}
                style={{ 
                  fontSize: '12.5px', color: '#cbd5e1', 
                  cursor: 'pointer', overflow: 'hidden', 
                  textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  fontWeight: 500
                }}
                title={`Klik untuk membuka berkas\nPath: ${f.path}`}
                onMouseEnter={e => e.currentTarget.style.color = '#38bdf8'}
                onMouseLeave={e => e.currentTarget.style.color = '#cbd5e1'}
              >
                {f.name}
              </div>
            </div>
            
            {/* Quick Actions Panel */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', opacity: 0.8 }} className="file-actions">
              <button 
                onClick={() => handleOpen(f.path)}
                title="Buka Berkas"
                style={{
                  background: 'transparent', border: 'none', color: '#94a3b8', 
                  padding: '4px', cursor: 'pointer', borderRadius: '4px', display: 'flex'
                }}
                onMouseEnter={e => { e.currentTarget.style.color = '#38bdf8'; e.currentTarget.style.background = 'rgba(56,189,248,0.1)'; }}
                onMouseLeave={e => { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.background = 'transparent'; }}
              >
                <ExternalLink size={12} />
              </button>
              <button 
                onClick={() => window.electronAPI.revealPath(f.path)}
                title="Tampilkan di Finder"
                style={{
                  background: 'transparent', border: 'none', color: '#94a3b8', 
                  padding: '4px', cursor: 'pointer', borderRadius: '4px', display: 'flex'
                }}
                onMouseEnter={e => { e.currentTarget.style.color = '#60a5fa'; e.currentTarget.style.background = 'rgba(96,165,250,0.1)'; }}
                onMouseLeave={e => { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.background = 'transparent'; }}
              >
                <FolderOpen size={12} />
              </button>
              <button 
                onClick={() => handleCopyPath(f.path)}
                title="Salin Path"
                style={{
                  background: 'transparent', border: 'none', color: '#94a3b8', 
                  padding: '4px', cursor: 'pointer', borderRadius: '4px', display: 'flex'
                }}
                onMouseEnter={e => { e.currentTarget.style.color = '#34d399'; e.currentTarget.style.background = 'rgba(52,211,153,0.1)'; }}
                onMouseLeave={e => { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.background = 'transparent'; }}
              >
                <Copy size={12} />
              </button>
              <button 
                onClick={() => handleDelete(f.path, f.name)}
                title="Hapus Berkas"
                style={{
                  background: 'transparent', border: 'none', color: '#94a3b8', 
                  padding: '4px', cursor: 'pointer', borderRadius: '4px', display: 'flex'
                }}
                onMouseEnter={e => { e.currentTarget.style.color = '#f87171'; e.currentTarget.style.background = 'rgba(248,113,113,0.1)'; }}
                onMouseLeave={e => { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.background = 'transparent'; }}
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', background: '#090a0f', overflow: 'hidden' }}>
      {/* Search and Refresh bar */}
      <div style={{ padding: '10px 12px', display: 'flex', gap: '8px', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center' }}>
          <Search size={13} style={{ position: 'absolute', left: '10px', color: '#4a5568' }} />
          <input 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Cari nama berkas..."
            style={{
              width: '100%',
              background: '#0d0e13',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '6px',
              padding: '6px 8px 6px 28px',
              color: '#e2e8f0',
              fontSize: '11.5px',
              outline: 'none',
              transition: 'border-color 0.2s'
            }}
            onFocus={e => e.currentTarget.style.borderColor = 'rgba(56,189,248,0.4)'}
            onBlur={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'}
          />
        </div>
        <button 
          onClick={fetchFiles}
          disabled={loading}
          title="Segarkan Berkas"
          style={{
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '6px',
            color: '#94a3b8',
            padding: '7px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            transition: 'background 0.2s'
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
        >
          <RefreshCw size={12} className={loading ? 'spin-anim' : ''} />
        </button>
      </div>

      {/* Files lists categorised */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px 24px 12px' }}>
        {files.length === 0 ? (
          <div style={{ padding: '40px 16px', textAlign: 'center', color: '#4a5568', fontSize: '12px' }}>
            Belum ada dokumen atau gambar hasil kerja AI di folder ini.
          </div>
        ) : (
          <>
            {renderCategoryHeader('Word & PDF Dokumen', docs.length, 'docs', <FileText size={14} />, '#60a5fa')}
            {!collapsed.docs && renderFileList(docs, '#60a5fa')}

            {renderCategoryHeader('Hasil Studio Gambar', images.length, 'images', <ImageIcon size={14} />, '#34d399')}
            {!collapsed.images && renderFileList(images, '#34d399')}

            {renderCategoryHeader('Hasil Web Scrape', scrapes.length, 'scrapes', <Globe size={14} />, '#fb7185')}
            {!collapsed.scrapes && renderFileList(scrapes, '#fb7185')}

            {renderCategoryHeader('Berkas Lainnya', others.length, 'others', <File size={14} />, '#a78bfa')}
            {!collapsed.others && renderFileList(others, '#a78bfa')}
          </>
        )}
      </div>
      
      <style>{`
        .spin-anim {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
