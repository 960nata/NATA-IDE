import React, { useState, useEffect } from 'react';
import { Folder, File, ChevronLeft, ChevronRight, Home, RefreshCw, FilePlus, FolderPlus, Pencil, Trash2, Copy, FolderOpen, Scissors, Clipboard } from 'lucide-react';
import { toast } from '../toast';

// Warna & icon per ekstensi file (ala VS Code)
const EXT_COLOR = {
  js:'#f7df1e', jsx:'#61dafb', ts:'#3178c6', tsx:'#3178c6',
  html:'#e44d26', css:'#264de4', scss:'#cc6699', json:'#fbc02d',
  md:'#a0c4ff', py:'#3572A5', sh:'#89e051', yml:'#cc6699', yaml:'#cc6699',
  toml:'#9c4221', env:'#eee', txt:'#aaa', svg:'#ff9800', png:'#66bb6a',
  jpg:'#66bb6a', jpeg:'#66bb6a', webp:'#66bb6a', gif:'#66bb6a',
  pdf:'#f44336', docx:'#2196f3', pptx:'#ff5722', xlsx:'#4caf50',
  rs:'#dea584', go:'#00acd7', java:'#b07219', cpp:'#f34b7d', c:'#555599',
  vue:'#41b883', dart:'#00b4ab', swift:'#ff6b00', kt:'#a97bff',
};
const EXT_LABEL = {
  js:'JS', jsx:'JSX', ts:'TS', tsx:'TSX', html:'HTML', css:'CSS', scss:'SCSS',
  json:'JSON', md:'MD', py:'PY', sh:'SH', yml:'YML', yaml:'YML', toml:'TOML',
  rs:'RS', go:'GO', java:'JAVA', cpp:'C++', c:'C', vue:'VUE', dart:'DART',
  swift:'SWIFT', kt:'KT', svg:'SVG', pdf:'PDF', docx:'DOCX', pptx:'PPTX',
};
function FileIcon({ name }) {
  const ext = name.split('.').pop().toLowerCase();
  const color = EXT_COLOR[ext] || '#aaa';
  const label = EXT_LABEL[ext];
  if (label) {
    return (
      <span style={{
        width: 16, height: 16, borderRadius: '3px', flexShrink: 0,
        background: color + '22', border: `1px solid ${color}55`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '7px', fontWeight: 800, color, fontFamily: 'monospace', letterSpacing: '-0.5px'
      }}>{label.slice(0, 3)}</span>
    );
  }
  return <File size={15} style={{ color: '#888', flexShrink: 0 }} />;
}

// Node pohon — folder bisa di-expand, lazy load anak. Mempertahankan expand pas refresh.
const GIT_COLOR = { M: '#e2b340', A: '#5fb37a', D: '#e06c6c', '??': '#5fb37a', R: '#9b8cff', U: '#e06c6c' };
function TreeNode({ node, depth, onOpenFile, currentOpenFile, onContextMenu, refreshKey, gitMap = {}, onMove, selectedPaths = new Set(), onSelectPath }) {
  const [open, setOpen] = useState(false);
  const [children, setChildren] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const isActive = currentOpenFile === node.path;
  const isSelected = selectedPaths.has(node.path);
  const gstatus = gitMap[node.path];
  const gcolor = gstatus ? (GIT_COLOR[gstatus] || GIT_COLOR[gstatus[0]] || '#e2b340') : null;

  const loadChildren = async () => {
    const res = await window.electronAPI.readDir(node.path);
    if (res.success) {
      const sorted = [...res.files].sort((a, b) => {
        if (a.isDir && !b.isDir) return -1;
        if (!a.isDir && b.isDir) return 1;
        return a.name.localeCompare(b.name);
      });
      setChildren(sorted);
    }
  };
  // Reload anak pas refreshKey berubah (kalau lagi kebuka) biar perubahan kelihatan tanpa nutup
  useEffect(() => { if (open) loadChildren(); }, [refreshKey]);

  const toggle = async (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      onSelectPath?.(node.path, { toggle: true });
      return;
    }
    onSelectPath?.(node.path, { toggle: false });
    if (!node.isDir) { onOpenFile(node.path); return; }
    if (!open && children == null) await loadChildren();
    setOpen(o => !o);
  };

  return (
    <>
      <div
        onClick={toggle}
        onContextMenu={(e) => onContextMenu(e, node)}
        draggable
        onDragStart={(e) => { e.stopPropagation(); e.dataTransfer.setData('text/nata-path', node.path); }}
        onDragOver={node.isDir ? (e) => { e.preventDefault(); e.stopPropagation(); setDragOver(true); } : undefined}
        onDragLeave={node.isDir ? () => setDragOver(false) : undefined}
        onDrop={node.isDir ? (e) => {
          e.preventDefault(); e.stopPropagation(); setDragOver(false);
          const src = e.dataTransfer.getData('text/nata-path');
          if (src && src !== node.path) onMove?.(src, node.path);
        } : undefined}
        style={{
          display: 'flex', alignItems: 'center', gap: '5px',
          padding: '4px 8px', paddingLeft: `${8 + depth * 13}px`,
          borderRadius: '5px', cursor: 'pointer', fontSize: '13px',
          color: node.isDir ? 'var(--text-primary)' : isActive ? 'var(--accent-cyan)' : 'var(--text-secondary)',
          backgroundColor: dragOver ? 'rgba(96,165,250,0.18)' 
            : isSelected ? 'rgba(96, 165, 250, 0.18)' 
            : isActive ? 'rgba(0, 245, 255, 0.08)' 
            : 'transparent',
          outline: dragOver ? '1px dashed #60a5fa' : 'none',
        }}
        onMouseEnter={(e) => { if (!isActive && !dragOver && !isSelected) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)'; }}
        onMouseLeave={(e) => { 
          if (!isActive && !dragOver && !isSelected) {
            e.currentTarget.style.backgroundColor = 'transparent';
          } else if (isActive && !dragOver && !isSelected) {
            e.currentTarget.style.backgroundColor = 'rgba(0, 245, 255, 0.08)';
          } else if (isSelected) {
            e.currentTarget.style.backgroundColor = 'rgba(96, 165, 250, 0.18)';
          }
        }}
      >
        {node.isDir ? (
          <ChevronRight size={13} style={{ flexShrink: 0, color: '#6b7280', transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }} />
        ) : <span style={{ width: 13, flexShrink: 0 }} />}
        {node.isDir
          ? <Folder size={14} style={{ color: 'var(--accent-gemma)', flexShrink: 0 }} />
          : <FileIcon name={node.name} />}
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: isActive ? 600 : 400, color: gcolor || undefined }}>
          {node.name}
        </span>
        {gstatus && <span style={{ fontSize: '10px', fontWeight: 700, color: gcolor, flexShrink: 0, fontFamily: 'monospace' }}>{gstatus}</span>}
      </div>
      {open && children && children.map(c => (
        <TreeNode key={c.path} node={c} depth={depth + 1} onOpenFile={onOpenFile}
          currentOpenFile={currentOpenFile} onContextMenu={onContextMenu} refreshKey={refreshKey} gitMap={gitMap} onMove={onMove}
          selectedPaths={selectedPaths} onSelectPath={onSelectPath} />
      ))}
    </>
  );
}

export default function FileExplorer({ onOpenFile, currentOpenFile, rootPath }) {
  const [currentPath, setCurrentPath] = useState('');
  const [items, setItems] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [menu, setMenu] = useState(null); // {x, y, item} — context menu klik kanan
  const [refreshKey, setRefreshKey] = useState(0); // bump → tree reload anak yg kebuka
  const [gitMap, setGitMap] = useState({}); // absPath → status (M/A/D/??)
  const [selectedPaths, setSelectedPaths] = useState(new Set());
  const [clipboard, setClipboard] = useState(null); // { paths: [], operation: 'copy'|'cut' }
  const bumpTree = () => { setRefreshKey(k => k + 1); loadGit(); };

  useEffect(() => {
    setSelectedPaths(new Set());
  }, [rootPath]);

  const handleSelectPath = (path, options = { toggle: false }) => {
    if (options.toggle) {
      setSelectedPaths(prev => {
        const next = new Set(prev);
        if (next.has(path)) {
          next.delete(path);
        } else {
          next.add(path);
        }
        return next;
      });
    } else {
      setSelectedPaths(new Set([path]));
    }
  };

  const handleContextMenu = (e, item) => {
    e.preventDefault();
    setSelectedPaths(prev => {
      if (prev.has(item.path)) return prev;
      return new Set([item.path]);
    });
    setMenu({ x: e.clientX, y: e.clientY, item });
  };

  const loadGit = async () => {
    const r = rootPath || currentPath;
    if (!r) return;
    try {
      const g = await window.electronAPI.gitStatus(r);
      if (g?.isRepo) {
         const m = {};
        g.files.forEach(f => { m[`${r}/${f.path}`.replace(/\/+/g, '/')] = f.status; });
        setGitMap(m);
      } else setGitMap({});
    } catch {}
  };
  useEffect(() => { loadGit(); }, [rootPath, currentPath]);

  // ── Auto-refresh saat filesystem berubah (AI / terminal / git checkout, dll.) ──
  useEffect(() => {
    if (!window.electronAPI?.onWorkspaceChanged) return;
    let timer = null;
    const cleanup = window.electronAPI.onWorkspaceChanged(() => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        loadDirectory(currentPath);
        bumpTree();
      }, 150);
    });
    return () => { clearTimeout(timer); cleanup?.(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPath]);

  // ── Refresh paksa dari ChatAgent (setelah install/write selesai) ──────────────
  useEffect(() => {
    const handler = () => { loadDirectory(currentPath); bumpTree(); };
    window.addEventListener('nata-refresh-tree', handler);
    return () => window.removeEventListener('nata-refresh-tree', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPath]);

  // ── File ops ala VS Code ──────────────────────────────────────────────
  const newFile = async () => {
    const name = prompt('Nama file baru (boleh pakai folder, mis. src/App.jsx):');
    if (!name) return;
    const res = await window.electronAPI.createFile(`${currentPath}/${name}`);
    if (res.success) { loadDirectory(currentPath); bumpTree(); onOpenFile(`${currentPath}/${name}`); }
    else alert('Gagal membuat file: ' + res.error);
  };
  const newFolder = async () => {
    const name = prompt('Nama folder baru:');
    if (!name) return;
    const res = await window.electronAPI.makeDir(`${currentPath}/${name}`);
    if (res.success) { loadDirectory(currentPath); bumpTree(); }
    else alert('Gagal membuat folder: ' + res.error);
  };
  const renameItem = async (item) => {
    const newName = prompt('Nama baru:', item.name);
    if (!newName || newName === item.name) return;
    const dir = item.path.slice(0, item.path.lastIndexOf('/'));
    const res = await window.electronAPI.renamePath(item.path, `${dir}/${newName}`);
    if (res.success) { loadDirectory(currentPath); bumpTree(); }
    else alert('Gagal rename: ' + res.error);
  };
  const deleteItem = async (item) => {
    const list = selectedPaths.has(item.path) ? Array.from(selectedPaths) : [item.path];
    const isMulti = list.length > 1;
    const confirmMsg = isMulti 
      ? `Hapus ${list.length} item beserta isinya? Tidak bisa dibatalkan.`
      : `Hapus "${item.name}"${item.isDir ? ' beserta isinya' : ''}? Tidak bisa dibatalkan.`;
      
    if (!confirm(confirmMsg)) return;
    
    setLoading(true);
    let successCount = 0;
    let failMsg = '';
    for (const p of list) {
      const res = await window.electronAPI.deletePath(p);
      if (res.success) {
        successCount++;
      } else {
        failMsg = res.error;
      }
    }
    
    if (isMulti) {
      toast(`Berhasil menghapus ${successCount} item`, successCount === list.length ? 'success' : 'info');
    }
    if (failMsg) {
      alert('Gagal hapus: ' + failMsg);
    }
    setSelectedPaths(new Set());
    loadDirectory(currentPath);
    bumpTree();
  };
  const duplicateItem = async (item) => {
    const list = selectedPaths.has(item.path) ? Array.from(selectedPaths) : [item.path];
    setLoading(true);
    let failMsg = '';
    for (const p of list) {
      const res = await window.electronAPI.duplicatePath(p);
      if (!res.success) {
        failMsg = res.error;
      }
    }
    if (failMsg) {
      alert('Gagal duplikat: ' + failMsg);
    }
    setSelectedPaths(new Set());
    loadDirectory(currentPath);
    bumpTree();
  };
  const revealItem = (item) => window.electronAPI.revealPath(item.path);
  // Pindah file/folder ke dalam folder tujuan (drag-drop)
  const moveItem = async (srcPath, destDir) => {
    const name = srcPath.split('/').pop();
    const dest = `${destDir}/${name}`;
    if (srcPath === dest || dest.startsWith(srcPath + '/')) return; // jangan pindah ke dalam diri sendiri
    const res = await window.electronAPI.renamePath(srcPath, dest);
    if (res.success) { toast(`Dipindah ke ${destDir.split('/').pop()}/`, 'success'); loadDirectory(currentPath); bumpTree(); }
    else toast('Gagal pindah: ' + res.error, 'error');
  };

  const handleCopy = (pathsToCopy = null) => {
    const targets = pathsToCopy || (selectedPaths.size > 0 ? Array.from(selectedPaths) : []);
    if (targets.length === 0) return;
    setClipboard({ paths: targets, operation: 'copy' });
    toast(`Disalin: ${targets.length} item`, 'info');
  };

  const handleCut = (pathsToCut = null) => {
    const targets = pathsToCut || (selectedPaths.size > 0 ? Array.from(selectedPaths) : []);
    if (targets.length === 0) return;
    setClipboard({ paths: targets, operation: 'cut' });
    toast(`Dipotong: ${targets.length} item`, 'info');
  };

  const handlePaste = async (targetFolder = null) => {
    if (!clipboard || clipboard.paths.length === 0) return;
    const destDir = targetFolder || currentPath;
    setLoading(true);
    let successCount = 0;
    let failMsg = '';

    for (const src of clipboard.paths) {
      const name = src.split('/').pop();
      const dest = `${destDir}/${name}`;
      if (src === dest) continue;
      if (dest.startsWith(src + '/')) {
        failMsg = 'Tidak bisa menyalin folder ke dalam dirinya sendiri';
        continue;
      }

      if (clipboard.operation === 'copy') {
        const res = await window.electronAPI.copyPath(src, dest);
        if (res.success) successCount++;
        else failMsg = res.error;
      } else if (clipboard.operation === 'cut') {
        const res = await window.electronAPI.renamePath(src, dest);
        if (res.success) successCount++;
        else failMsg = res.error;
      }
    }

    if (clipboard.operation === 'cut' && successCount > 0) {
      setClipboard(null);
    }

    toast(`Berhasil menempel ${successCount} item`, 'success');
    if (failMsg) alert('Gagal menempel: ' + failMsg);

    loadDirectory(currentPath);
    bumpTree();
  };

  const handleKeyDown = (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if ((e.metaKey || e.ctrlKey) && e.key === 'c') {
      e.preventDefault();
      handleCopy();
    } else if ((e.metaKey || e.ctrlKey) && e.key === 'x') {
      e.preventDefault();
      handleCut();
    } else if ((e.metaKey || e.ctrlKey) && e.key === 'v') {
      e.preventDefault();
      handlePaste();
    }
  };

  const cleanWorkspace = async () => {
    const isRoot = currentPath === rootPath;
    const folderName = isRoot ? 'Workspace' : currentPath.split('/').pop();
    const yes = window.confirm(`Apakah Anda yakin ingin menghapus semua berkas dan folder di dalam "${folderName}" untuk mulai dari awal?\n\nTindakan ini tidak dapat dibatalkan!`);
    if (!yes) return;
    
    setLoading(true);
    try {
      for (const item of items) {
        await window.electronAPI.deletePath(item.path);
      }
      toast('Workspace berhasil dibersihkan!', 'success');
    } catch (err) {
      toast('Gagal membersihkan: ' + err.message, 'error');
    } finally {
      loadDirectory(currentPath);
      bumpTree();
    }
  };

  const loadDirectory = async (path) => {
    setSelectedPaths(new Set());
    setLoading(true);
    setError('');
    try {
      const res = await window.electronAPI.readDir(path);
      if (res.success) {
        // Sort: folders first, then files alphabetically
        const sorted = [...res.files].sort((a, b) => {
          if (a.isDir && !b.isDir) return -1;
          if (!a.isDir && b.isDir) return 1;
          return a.name.localeCompare(b.name);
        });
        setItems(sorted);
        setCurrentPath(res.currentPath);
      } else {
        setError(res.error || 'Failed to read directory');
      }
    } catch (err) {
      setError(err.message || 'Error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      try {
        if (rootPath) {
          setHistory([]);
          loadDirectory(rootPath);
        } else {
          const info = await window.electronAPI.getSystemInfo();
          loadDirectory(info.cwd);
        }
      } catch (e) {
        setError('Could not connect to Electron Main process');
        setLoading(false);
      }
    };
    init();
  }, [rootPath]);

  const handleFolderClick = (dirPath) => {
    setHistory([...history, currentPath]);
    loadDirectory(dirPath);
  };

  const handleGoBack = () => {
    if (history.length > 0) {
      const prev = history[history.length - 1];
      setHistory(history.slice(0, -1));
      loadDirectory(prev);
    } else {
      // Try to go up one folder
      const parts = currentPath.split('/');
      if (parts.length > 1) {
        parts.pop();
        const parent = parts.join('/') || '/';
        loadDirectory(parent);
      }
    }
  };

  const handleGoHome = async () => {
    const info = await window.electronAPI.getSystemInfo();
    setHistory([]);
    loadDirectory(info.cwd);
  };

  const getFolderName = (path) => {
    if (!path) return 'EXPLORER';
    const clean = path.replace(/\/$/, '');
    const name = clean.split('/').pop();
    return name ? name.toUpperCase() : 'EXPLORER';
  };

  const formattedBreadcrumb = () => {
    const relative = currentPath.replace(/^\/Users\/[^\/]+/, '~');
    return relative.split('/').filter(Boolean).join('  /  ');
  };

  return (
    <div
      tabIndex={0}
      onKeyDown={handleKeyDown}
      // Drag & drop file dari Finder/luar → dicopy ke workspace
      onDragOver={(e) => {
        if ([...(e.dataTransfer?.types || [])].includes('Files')) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }
      }}
      onDrop={async (e) => {
        const files = [...(e.dataTransfer?.files || [])];
        if (!files.length || e.dataTransfer.getData('text/nata-path')) return; // internal drag → biarin handler node
        e.preventDefault(); e.stopPropagation();
        const dest = rootPath || currentPath;
        let ok = 0;
        for (const f of files) {
          if (!f.path) continue;
          const r = await window.electronAPI.copyPath(f.path, `${dest}/${f.name}`).catch(() => null);
          if (r?.success) ok++;
        }
        if (ok) { loadDirectory(currentPath); bumpTree(); }
      }}
      style={{
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'rgba(9, 10, 15, 0.5)',
        outline: 'none'
      }}
    >
      {/* File Explorer Header */}
      <div style={{
        padding: '12px 14px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid var(--border-color)',
        background: '#131315',
        height: '42px'
      }}>
        <span style={{ 
          fontWeight: 700, 
          fontSize: '12.5px', 
          letterSpacing: '0.05em', 
          color: '#e3e3e6',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          flex: 1
        }}>
          {getFolderName(rootPath || currentPath)}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginLeft: '8px', flexShrink: 0 }}>
          <button
            onClick={newFile}
            title="File Baru"
            style={{
              background: 'transparent',
              border: 'none',
              color: '#8e8e93',
              cursor: 'pointer',
              display: 'flex',
              padding: '2px',
              transition: 'color 0.2s'
            }}
            onMouseEnter={e => e.currentTarget.style.color = '#fff'}
            onMouseLeave={e => e.currentTarget.style.color = '#8e8e93'}
          >
            <FilePlus size={14} />
          </button>
          <button
            onClick={newFolder}
            title="Folder Baru"
            style={{
              background: 'transparent',
              border: 'none',
              color: '#8e8e93',
              cursor: 'pointer',
              display: 'flex',
              padding: '2px',
              transition: 'color 0.2s'
            }}
            onMouseEnter={e => e.currentTarget.style.color = '#fff'}
            onMouseLeave={e => e.currentTarget.style.color = '#8e8e93'}
          >
            <FolderPlus size={14} />
          </button>
          <button 
            onClick={() => loadDirectory(currentPath)}
            title="Segarkan"
            style={{
              background: 'transparent',
              border: 'none',
              color: '#8e8e93',
              cursor: 'pointer',
              display: 'flex',
              padding: '2px',
              transition: 'color 0.2s'
            }}
            onMouseEnter={e => e.currentTarget.style.color = '#fff'}
            onMouseLeave={e => e.currentTarget.style.color = '#8e8e93'}
          >
            <RefreshCw size={12} />
          </button>
          <button 
            onClick={cleanWorkspace}
            title="Bersihkan Folder Workspace"
            style={{
              background: 'transparent',
              border: 'none',
              color: '#8e8e93',
              cursor: 'pointer',
              display: 'flex',
              padding: '2px',
              transition: 'color 0.2s'
            }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--accent-magenta, #ff5ce1)'}
            onMouseLeave={e => e.currentTarget.style.color = '#8e8e93'}
          >
            <Trash2 size={12} />
          </button>
          <button 
            onClick={handleGoBack}
            disabled={history.length === 0}
            title="Kembali"
            style={{
              background: 'transparent',
              border: 'none',
              color: history.length === 0 ? 'rgba(255,255,255,0.15)' : '#8e8e93',
              cursor: history.length === 0 ? 'default' : 'pointer',
              display: 'flex',
              padding: '2px',
              transition: 'color 0.2s'
            }}
            onMouseEnter={e => { if (history.length > 0) e.currentTarget.style.color = '#fff'; }}
            onMouseLeave={e => { if (history.length > 0) e.currentTarget.style.color = '#8e8e93'; }}
          >
            <ChevronLeft size={15} />
          </button>
          <button 
            onClick={handleGoHome}
            title="Ke Beranda"
            style={{
              background: 'transparent',
              border: 'none',
              color: '#8e8e93',
              cursor: 'pointer',
              display: 'flex',
              padding: '2px',
              transition: 'color 0.2s'
            }}
            onMouseEnter={e => e.currentTarget.style.color = '#fff'}
            onMouseLeave={e => e.currentTarget.style.color = '#8e8e93'}
          >
            <Home size={14} />
          </button>
        </div>
      </div>

      {/* Path Breadcrumb */}
      <div style={{
        padding: '6px 14px',
        fontSize: '10.5px',
        color: '#5f6475',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        borderBottom: '1px solid rgba(255,255,255,0.03)',
        background: '#18181c',
        fontFamily: '"JetBrains Mono", monospace'
      }}>
        {formattedBreadcrumb()}
      </div>

      {/* Directory Contents */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '8px'
      }}>
        {loading ? (
          <div style={{ padding: '20px', textAlign: 'center', fontSize: '12px', color: 'var(--text-secondary)' }}>
            Loading...
          </div>
        ) : error ? (
          <div style={{ padding: '20px', color: 'var(--accent-magenta)', fontSize: '11px', textAlign: 'center' }}>
            {error}
          </div>
        ) : items.length === 0 ? (
          <div style={{ padding: '20px', color: 'var(--text-muted)', fontSize: '11px', textAlign: 'center' }}>
            Folder Kosong
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
            {items.map((item) => (
              <TreeNode
                key={item.path}
                node={item}
                depth={0}
                onOpenFile={onOpenFile}
                currentOpenFile={currentOpenFile}
                onContextMenu={handleContextMenu}
                refreshKey={refreshKey}
                gitMap={gitMap}
                onMove={moveItem}
                selectedPaths={selectedPaths}
                onSelectPath={handleSelectPath}
              />
            ))}
          </div>
        )}
      </div>

      {/* Context menu klik-kanan — rename & delete */}
      {menu && (() => {
        const isMulti = selectedPaths.size > 1 && selectedPaths.has(menu.item.path);
        return (
          <>
            <div onClick={() => setMenu(null)} onContextMenu={(e) => { e.preventDefault(); setMenu(null); }}
              style={{ position: 'fixed', inset: 0, zIndex: 999 }} />
            <div style={{
              position: 'fixed', top: Math.min(menu.y, window.innerHeight - 180), left: Math.min(menu.x, window.innerWidth - 180),
              zIndex: 1000, background: '#1d1d22', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.5)', padding: '4px', minWidth: '160px', overflow: 'hidden'
            }}>
              <div style={{ padding: '5px 10px', fontSize: '10px', color: '#5f6475', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {isMulti ? `${selectedPaths.size} item terpilih` : menu.item.name}
              </div>
              {!isMulti && (
                <button onClick={() => { const it = menu.item; setMenu(null); renameItem(it); }}
                  style={ctxBtn} onMouseEnter={ctxHover} onMouseLeave={ctxLeave}>
                  <Pencil size={13} /> Ganti Nama
                </button>
              )}
              <button onClick={() => { const it = menu.item; setMenu(null); handleCopy([it.path]); }}
                style={ctxBtn} onMouseEnter={ctxHover} onMouseLeave={ctxLeave}>
                <Copy size={13} /> {isMulti ? `Salin (${selectedPaths.size} item)` : 'Salin'}
              </button>
              <button onClick={() => { const it = menu.item; setMenu(null); handleCut([it.path]); }}
                style={ctxBtn} onMouseEnter={ctxHover} onMouseLeave={ctxLeave}>
                <Scissors size={13} /> {isMulti ? `Potong (${selectedPaths.size} item)` : 'Potong'}
              </button>
              {clipboard && (
                <button onClick={() => { const it = menu.item; setMenu(null); handlePaste(it.isDir ? it.path : null); }}
                  style={ctxBtn} onMouseEnter={ctxHover} onMouseLeave={ctxLeave}>
                  <Clipboard size={13} /> Tempel di Sini
                </button>
              )}
              <button onClick={() => { const it = menu.item; setMenu(null); duplicateItem(it); }}
                style={ctxBtn} onMouseEnter={ctxHover} onMouseLeave={ctxLeave}>
                <Copy size={13} /> {isMulti ? `Duplikat (${selectedPaths.size} item)` : 'Duplikat'}
              </button>
              {!isMulti && (
                <button onClick={() => { const it = menu.item; setMenu(null); revealItem(it); }}
                  style={ctxBtn} onMouseEnter={ctxHover} onMouseLeave={ctxLeave}>
                  <FolderOpen size={13} /> Tampilkan di Finder
                </button>
              )}
              <button onClick={() => { const it = menu.item; setMenu(null); deleteItem(it); }}
                style={{ ...ctxBtn, color: '#f87171' }} onMouseEnter={ctxHover} onMouseLeave={ctxLeave}>
                <Trash2 size={13} /> {isMulti ? `Hapus (${selectedPaths.size} item)` : 'Hapus'}
              </button>
            </div>
          </>
        );
      })()}
    </div>
  );
}

const ctxBtn = {
  display: 'flex', alignItems: 'center', gap: '8px', width: '100%',
  background: 'transparent', border: 'none', borderRadius: '5px',
  color: '#e3e3e6', padding: '7px 10px', fontSize: '12px', cursor: 'pointer', textAlign: 'left',
};
const ctxHover = (e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; };
const ctxLeave = (e) => { e.currentTarget.style.background = 'transparent'; };
