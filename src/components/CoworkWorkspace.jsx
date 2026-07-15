import React, { useState, useEffect, useCallback, useRef } from 'react';
import { FileText, Image as ImageIcon, Globe, File, Search, Trash2, FolderOpen, ExternalLink, Copy, RefreshCw, ChevronDown, ChevronRight, Calendar, Plus, Clock, Check, ArrowRight, ArrowLeft } from 'lucide-react';
import { toast } from '../toast';

const DOC_EXTS = ['docx', 'pdf', 'pptx', 'xlsx', 'txt', 'doc', 'csv'];
const IMG_EXTS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'];
const SCRAPE_EXTS = ['md', 'html'];
const IGNORE_PATTERNS = ['.git', 'node_modules', 'dist', 'dist-electron', 'package.json', 'package-lock.json', '.DS_Store', '.next', 'build', '.cache', '__pycache__', '.venv', 'venv'];

const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const fmtWaktu = (ms) => new Date(ms).toLocaleString('id-ID', { weekday: 'short', hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' });

export default function CoworkWorkspace({ rootPath }) {
  const [activeTab, setActiveTab] = useState('tasks'); // default ke tasks / agenda
  const [homeDir, setHomeDir] = useState('');
  
  // Files State
  const [files, setFiles] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [collapsed, setCollapsed] = useState({
    docs: false,
    images: false,
    scrapes: false,
    others: false,
  });

  // Tasks State
  const [todos, setTodos] = useState([]);
  const [alarms, setAlarms] = useState([]);
  const [taskText, setTaskText] = useState('');
  const [alarmEnabled, setAlarmEnabled] = useState(false);
  const [alarmMode, setAlarmMode] = useState('minutes'); // 'minutes' | 'at'
  const [alarmMinutes, setAlarmMinutes] = useState(5);
  const [alarmTime, setAlarmTime] = useState('');
  const [activeTaskColumn, setActiveTaskColumn] = useState('todo'); // 'todo' | 'inprogress' | 'done'

  // Responsive Board state
  const containerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(0);

  const ext = (p) => (p || '').split('.').pop().toLowerCase();

  const getTodosPath = () => homeDir ? `${homeDir}/.nata/todos.json` : '';
  const getAlarmsPath = () => homeDir ? `${homeDir}/.nata/alarms.json` : '';

  // 1. Fetch Files
  const fetchFiles = useCallback(async () => {
    if (!rootPath) return;
    setLoading(true);
    try {
      const res = await window.electronAPI.listFiles(rootPath);
      if (res && res.success) {
        const filtered = (res.files || []).filter(f => {
          const name = f.name;
          const parts = f.path.replace(rootPath, '').split('/');
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

  // 2. Fetch Tasks and Alarms
  const fetchTasksData = useCallback(async () => {
    if (!homeDir) return;
    const todosPath = getTodosPath();
    const alarmsPath = getAlarmsPath();

    try {
      // Baca Todos
      const todosRes = await window.electronAPI.readFile(todosPath);
      if (todosRes.success && todosRes.content) {
        const parsed = JSON.parse(todosRes.content);
        const mapped = parsed.map(t => ({
          ...t,
          status: t.status || (t.done ? 'done' : 'todo')
        }));
        setTodos(mapped);
      } else {
        setTodos([]);
      }

      // Baca Alarms
      const alarmsRes = await window.electronAPI.readFile(alarmsPath);
      if (alarmsRes.success && alarmsRes.content) {
        setAlarms(JSON.parse(alarmsRes.content));
      } else {
        setAlarms([]);
      }
    } catch (e) {
      console.error('Gagal memuat tugas/alarm:', e);
    }
  }, [homeDir]);

  // Save Todos to File
  const saveTodos = async (updatedTodos) => {
    const todosPath = getTodosPath();
    if (!todosPath) return;
    try {
      const res = await window.electronAPI.writeFile(todosPath, JSON.stringify(updatedTodos, null, 2));
      if (res.success) {
        setTodos(updatedTodos);
      } else {
        toast('Gagal menyimpan tugas: ' + res.error, 'error');
      }
    } catch (e) {
      toast('Gagal menyimpan tugas: ' + e.message, 'error');
    }
  };

  useEffect(() => {
    window.electronAPI.getSystemInfo().then(info => {
      if (info && info.home) {
        setHomeDir(info.home);
      }
    });
  }, []);

  useEffect(() => {
    if (homeDir) {
      fetchTasksData();
    }
  }, [homeDir, fetchTasksData]);

  useEffect(() => {
    fetchFiles();
    
    // Auto-refresh when AI finishes a tool
    const handleToolRan = () => {
      setTimeout(() => {
        fetchFiles();
        fetchTasksData();
      }, 500);
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
  }, [fetchFiles, fetchTasksData]);

  // Measure Container Width for responsiveness
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(entries => {
      for (let entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Task Actions
  const handleAddTask = async (e) => {
    e.preventDefault();
    if (!taskText.trim()) return;

    let alarmId = null;
    if (alarmEnabled) {
      const alarmArgs = { message: taskText.trim() };
      if (alarmMode === 'minutes') {
        alarmArgs.minutes = Number(alarmMinutes);
      } else if (alarmMode === 'at') {
        alarmArgs.at = alarmTime;
      }

      toast('Menjadwalkan alarm...', 'info');
      const alarmRes = await window.electronAPI.runTool('alarm', alarmArgs);
      if (alarmRes.success) {
        // Baca file alarms.json terbaru untuk mencari ID-nya
        const alarmsPath = getAlarmsPath();
        const alarmsFetch = await window.electronAPI.readFile(alarmsPath);
        if (alarmsFetch.success && alarmsFetch.content) {
          const latestAlarms = JSON.parse(alarmsFetch.content);
          const matching = latestAlarms.find(a => a.message === taskText.trim());
          if (matching) {
            alarmId = matching.id;
          }
        }
        toast('Alarm berhasil disetel!', 'success');
      } else {
        toast('Gagal menyetel alarm: ' + alarmRes.message, 'error');
      }
    }

    const newTodo = {
      id: newId(),
      text: taskText.trim(),
      done: false,
      status: 'todo',
      createdAt: Date.now(),
      alarmId
    };

    const updated = [...todos, newTodo];
    await saveTodos(updated);
    
    // Reset Form
    setTaskText('');
    setAlarmEnabled(false);
    setAlarmTime('');
    fetchTasksData();
    toast('Tugas ditambahkan ke papan cowork', 'success');
  };

  const handleMoveTask = async (taskId, newStatus) => {
    const updated = todos.map(t => {
      if (t.id === taskId) {
        // Jika dipindah ke 'done', matikan alarm jika ada
        if (newStatus === 'done' && t.alarmId) {
          window.electronAPI.runTool('cancel_alarm', { id: t.alarmId }).then(res => {
            if (res.success) {
              toast(`Alarm untuk "${t.text}" dibatalkan`, 'info');
            }
          });
          return { ...t, status: newStatus, done: true, alarmId: null };
        }
        return { ...t, status: newStatus, done: newStatus === 'done' };
      }
      return t;
    });

    await saveTodos(updated);
    fetchTasksData();
  };

  const handleDeleteTask = async (taskId, alarmId) => {
    if (confirm('Apakah Anda yakin ingin menghapus tugas ini?')) {
      if (alarmId) {
        await window.electronAPI.runTool('cancel_alarm', { id: alarmId });
      }
      const updated = todos.filter(t => t.id !== taskId);
      await saveTodos(updated);
      fetchTasksData();
      toast('Tugas berhasil dihapus', 'success');
    }
  };

  // Files tab actions
  const handleOpen = async (filePath) => {
    try {
      const res = await window.electronAPI.openExternal(`file://${filePath}`);
      if (res && res.success) {
        toast('Berkas berhasil dibuka', 'success');
      } else {
        window.electronAPI.revealPath(filePath);
        toast('Menampilkan berkas di Finder', 'info');
      }
    } catch (err) {
      window.electronAPI.revealPath(filePath);
      toast('Menampilkan berkas di Finder', 'info');
    }
  };

  const handleDeleteFile = async (filePath, fileName) => {
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
  const filteredFilesQuery = files.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const docs = filteredFilesQuery.filter(f => DOC_EXTS.includes(ext(f.name)));
  const images = filteredFilesQuery.filter(f => IMG_EXTS.includes(ext(f.name)));
  const scrapes = filteredFilesQuery.filter(f => SCRAPE_EXTS.includes(ext(f.name)));
  const others = filteredFilesQuery.filter(f => !DOC_EXTS.includes(ext(f.name)) && !IMG_EXTS.includes(ext(f.name)) && !SCRAPE_EXTS.includes(ext(f.name)));

  // Tasks categorized
  const todoTasks = todos.filter(t => t.status === 'todo');
  const inProgressTasks = todos.filter(t => t.status === 'inprogress');
  const doneTasks = todos.filter(t => t.status === 'done');

  // Render helpers
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
                onClick={() => handleDeleteFile(f.path, f.name)}
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

  const renderTaskCard = (t) => {
    // Cari apakah ada alarm terdaftar
    const alarm = alarms.find(a => a.id === t.alarmId);
    
    return (
      <div 
        key={t.id}
        style={{
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          borderRadius: '8px',
          padding: '10px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          transition: 'all 0.2s',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.borderColor = 'rgba(56, 189, 248, 0.2)';
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.06)';
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)';
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
          <span style={{ 
            fontSize: '12px', 
            color: t.status === 'done' ? '#64748b' : '#e2e8f0',
            textDecoration: t.status === 'done' ? 'line-through' : 'none',
            fontWeight: 500,
            lineHeight: 1.4,
            wordBreak: 'break-word'
          }}>
            {t.text}
          </span>
          <button 
            onClick={() => handleDeleteTask(t.id, t.alarmId)}
            title="Hapus"
            style={{
              background: 'transparent', border: 'none', color: '#64748b', 
              cursor: 'pointer', padding: '2px', display: 'flex', height: 'fit-content'
            }}
            onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
            onMouseLeave={e => e.currentTarget.style.color = '#64748b'}
          >
            <Trash2 size={12} />
          </button>
        </div>

        {/* Info Alarm & Tanggal */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px', fontSize: '10px', color: '#64748b' }}>
          <span>{fmtWaktu(t.createdAt)}</span>
          {alarm && (
            <div style={{ 
              display: 'flex', alignItems: 'center', gap: '3px', 
              color: '#fbbf24', background: 'rgba(251, 191, 36, 0.08)',
              padding: '1px 6px', borderRadius: '4px', fontWeight: 600
            }}>
              <Clock size={9} />
              <span>{fmtWaktu(alarm.atMs)}</span>
            </div>
          )}
        </div>

        {/* Pemindah Kolom */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '4px', marginTop: '4px', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '6px' }}>
          {t.status !== 'todo' && (
            <button 
              onClick={() => handleMoveTask(t.id, t.status === 'done' ? 'inprogress' : 'todo')}
              style={{
                background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)',
                borderRadius: '4px', color: '#94a3b8', padding: '2px 6px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '3px', fontSize: '9px', fontWeight: 600
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#cbd5e1'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; e.currentTarget.style.color = '#94a3b8'; }}
            >
              <ArrowLeft size={10} /> Kembali
            </button>
          )}
          {t.status !== 'done' && (
            <button 
              onClick={() => handleMoveTask(t.id, t.status === 'todo' ? 'inprogress' : 'done')}
              style={{
                background: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.2)',
                borderRadius: '4px', color: '#38bdf8', padding: '2px 6px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '3px', fontSize: '9px', fontWeight: 600
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(56, 189, 248, 0.15)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(56, 189, 248, 0.08)'; }}
            >
              {t.status === 'inprogress' ? 'Kelar' : 'Kerjakan'} <ArrowRight size={10} />
            </button>
          )}
        </div>
      </div>
    );
  };

  const renderTaskColumn = (title, tasks, statusKey, color) => {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', minWidth: 0 }}>
        {/* Column Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', borderBottom: `2px solid ${color}`, paddingBottom: '6px', marginBottom: '4px' }}>
          <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', tracking: '0.05em', color }}>
            {title}
          </span>
          <span style={{ 
            fontSize: '9.5px', fontWeight: 800, color: '#94a3b8', 
            background: 'rgba(255,255,255,0.05)', padding: '1px 6px', 
            borderRadius: '10px' 
          }}>
            {tasks.length}
          </span>
        </div>

        {/* Task Cards list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', flex: 1, paddingRight: '2px' }}>
          {tasks.length === 0 ? (
            <div style={{ padding: '16px', border: '1px dashed rgba(255,255,255,0.02)', borderRadius: '8px', textAlign: 'center', color: '#4a5568', fontSize: '11px', fontStyle: 'italic' }}>
              Kosong
            </div>
          ) : (
            tasks.map(t => renderTaskCard(t))
          )}
        </div>
      </div>
    );
  };

  return (
    <div ref={containerRef} style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', background: '#08090c', overflow: 'hidden' }}>
      
      {/* Sub Header / Tabs Navigasi */}
      <div style={{ display: 'flex', background: '#0b0c10', borderBottom: '1px solid rgba(255,255,255,0.04)', padding: '4px 8px 0 8px' }}>
        <button 
          onClick={() => setActiveTab('tasks')}
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            borderBottom: activeTab === 'tasks' ? '2px solid #38bdf8' : '2px solid transparent',
            color: activeTab === 'tasks' ? '#38bdf8' : '#64748b',
            fontSize: '11.5px',
            fontWeight: 700,
            padding: '8px 12px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            transition: 'all 0.2s'
          }}
        >
          <Calendar size={13} />
          Co-work Board
        </button>
        <button 
          onClick={() => setActiveTab('files')}
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            borderBottom: activeTab === 'files' ? '2px solid #38bdf8' : '2px solid transparent',
            color: activeTab === 'files' ? '#38bdf8' : '#64748b',
            fontSize: '11.5px',
            fontWeight: 700,
            padding: '8px 12px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            transition: 'all 0.2s'
          }}
        >
          <FileText size={13} />
          Files Hub
        </button>
      </div>

      {/* Tampilan Content berdasarkan Tab Aktif */}
      {activeTab === 'files' ? (
        // ================= TAB FILES (KODE LAMA) =================
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
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
        </div>
      ) : (
        // ================= TAB BOARD TASKS & REMINDERS (BARU) =================
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          
          {/* Panel Input Pembuatan Tugas Baru */}
          <form onSubmit={handleAddTask} style={{ padding: '12px', background: '#0b0c10', borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ fontSize: '10.5px', fontWeight: 800, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              📋 Buat Agenda Baru
            </div>
            
            <div style={{ display: 'flex', gap: '8px' }}>
              <input 
                value={taskText}
                onChange={e => setTaskText(e.target.value)}
                placeholder="Apa tugas berikutnya, cuy?"
                style={{
                  flex: 1,
                  background: '#07080b',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: '6px',
                  padding: '6px 10px',
                  color: '#e2e8f0',
                  fontSize: '12px',
                  outline: 'none',
                }}
                onFocus={e => e.currentTarget.style.borderColor = 'rgba(56,189,248,0.3)'}
                onBlur={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'}
              />
              <button 
                type="submit"
                style={{
                  background: '#38bdf8',
                  border: 'none',
                  borderRadius: '6px',
                  color: '#090a0f',
                  padding: '6px 12px',
                  fontWeight: 700,
                  fontSize: '11.5px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  transition: 'background 0.2s'
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#0ea5e9'}
                onMouseLeave={e => e.currentTarget.style.background = '#38bdf8'}
              >
                <Plus size={13} /> Tambah
              </button>
            </div>

            {/* Opsi Pengingat / Alarm */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', background: 'rgba(255,255,255,0.02)', padding: '8px 10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.03)' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '11px', color: '#94a3b8', userSelect: 'none' }}>
                <input 
                  type="checkbox"
                  checked={alarmEnabled}
                  onChange={e => setAlarmEnabled(e.target.checked)}
                  style={{ accentColor: '#38bdf8' }}
                />
                <Clock size={11} style={{ color: alarmEnabled ? '#fbbf24' : '#64748b' }} />
                <span>Setel Alarm Pengingat (Notifikasi)</span>
              </label>

              {alarmEnabled && (
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', paddingLeft: '20px', marginTop: '2px', borderLeft: '2px solid rgba(56,189,248,0.2)' }}>
                  
                  {/* Pilihan Mode Alarm */}
                  <div style={{ display: 'flex', gap: '8px', fontSize: '10.5px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', color: alarmMode === 'minutes' ? '#cbd5e1' : '#64748b' }}>
                      <input 
                        type="radio" 
                        name="alarmMode" 
                        checked={alarmMode === 'minutes'}
                        onChange={() => setAlarmMode('minutes')}
                        style={{ accentColor: '#38bdf8' }}
                      />
                      Menit
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', color: alarmMode === 'at' ? '#cbd5e1' : '#64748b' }}>
                      <input 
                        type="radio" 
                        name="alarmMode" 
                        checked={alarmMode === 'at'}
                        onChange={() => setAlarmMode('at')}
                        style={{ accentColor: '#38bdf8' }}
                      />
                      Jam
                    </label>
                  </div>

                  {/* Input Detail Waktu */}
                  {alarmMode === 'minutes' ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <input 
                        type="number"
                        min="1"
                        value={alarmMinutes}
                        onChange={e => setAlarmMinutes(Math.max(1, parseInt(e.target.value) || 1))}
                        style={{
                          width: '45px',
                          background: '#07080b',
                          border: '1px solid rgba(255,255,255,0.06)',
                          borderRadius: '4px',
                          padding: '3px 6px',
                          color: '#e2e8f0',
                          fontSize: '11px',
                          textAlign: 'center'
                        }}
                      />
                      <span style={{ fontSize: '10.5px', color: '#64748b' }}>menit lagi</span>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <input 
                        type="text"
                        placeholder="HH:MM (misal 17:30)"
                        value={alarmTime}
                        onChange={e => setAlarmTime(e.target.value)}
                        style={{
                          width: '120px',
                          background: '#07080b',
                          border: '1px solid rgba(255,255,255,0.06)',
                          borderRadius: '4px',
                          padding: '3px 6px',
                          color: '#e2e8f0',
                          fontSize: '11px',
                          textAlign: 'center'
                        }}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </form>

          {/* Kanban Board Container */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '12px' }}>
            
            {/* Responsif: Jika Lebar Sidebar Sempit (< 500px), Tampilkan Menu Tab Kolom */}
            {containerWidth < 500 ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px', overflow: 'hidden' }}>
                {/* Segemented Control Tab Kolom */}
                <div style={{ display: 'flex', background: 'rgba(255,255,255,0.02)', padding: '2px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <button 
                    onClick={() => setActiveTaskColumn('todo')}
                    style={{
                      flex: 1, padding: '6px', fontSize: '10px', fontWeight: 700, borderRadius: '4px', border: 'none', cursor: 'pointer',
                      background: activeTaskColumn === 'todo' ? '#60a5fa' : 'transparent',
                      color: activeTaskColumn === 'todo' ? '#090a0f' : '#64748b',
                      transition: 'all 0.2s'
                    }}
                  >
                    Rencana ({todoTasks.length})
                  </button>
                  <button 
                    onClick={() => setActiveTaskColumn('inprogress')}
                    style={{
                      flex: 1, padding: '6px', fontSize: '10px', fontWeight: 700, borderRadius: '4px', border: 'none', cursor: 'pointer',
                      background: activeTaskColumn === 'inprogress' ? '#fbbf24' : 'transparent',
                      color: activeTaskColumn === 'inprogress' ? '#090a0f' : '#64748b',
                      transition: 'all 0.2s'
                    }}
                  >
                    Proses ({inProgressTasks.length})
                  </button>
                  <button 
                    onClick={() => setActiveTaskColumn('done')}
                    style={{
                      flex: 1, padding: '6px', fontSize: '10px', fontWeight: 700, borderRadius: '4px', border: 'none', cursor: 'pointer',
                      background: activeTaskColumn === 'done' ? '#34d399' : 'transparent',
                      color: activeTaskColumn === 'done' ? '#090a0f' : '#64748b',
                      transition: 'all 0.2s'
                    }}
                  >
                    Selesai ({doneTasks.length})
                  </button>
                </div>

                {/* Kolom Terpilih */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  {activeTaskColumn === 'todo' && renderTaskColumn('Rencana (To Do)', todoTasks, 'todo', '#60a5fa')}
                  {activeTaskColumn === 'inprogress' && renderTaskColumn('Berlangsung', inProgressTasks, 'inprogress', '#fbbf24')}
                  {activeTaskColumn === 'done' && renderTaskColumn('Selesai (Done)', doneTasks, 'done', '#34d399')}
                </div>
              </div>
            ) : (
              // Responsif: Jika Lebar Sidebar Cukup Luas, Tampilkan 3 Kolom Bersandingan
              <div style={{ flex: 1, display: 'flex', gap: '12px', overflow: 'hidden' }}>
                {renderTaskColumn('Rencana (To Do)', todoTasks, 'todo', '#60a5fa')}
                <div style={{ width: '1px', background: 'rgba(255,255,255,0.03)' }} />
                {renderTaskColumn('Berlangsung', inProgressTasks, 'inprogress', '#fbbf24')}
                <div style={{ width: '1px', background: 'rgba(255,255,255,0.03)' }} />
                {renderTaskColumn('Selesai (Done)', doneTasks, 'done', '#34d399')}
              </div>
            )}
          </div>
        </div>
      )}
      
      <style>{`
        .spin-anim {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          100% { transform: rotate(360deg); }
        }
        .cowork-file-item:hover .file-actions {
          opacity: 1 !important;
        }
      `}</style>
    </div>
  );
}
