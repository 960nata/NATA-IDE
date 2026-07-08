import React, { useState, useEffect } from 'react';
import { Search, GitBranch, RefreshCw, FileText, Construction, Zap, Plus, Trash2, Download, ChevronDown, ChevronRight } from 'lucide-react';

const PanelHeader = ({ title }) => (
  <div style={{
    padding: '14px 12px 8px 12px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em',
    textTransform: 'uppercase', color: 'var(--text-secondary)'
  }}>{title}</div>
);

const baseName = (p) => p.split('/').pop();

// --- Search di seluruh file workspace -----------------------------------
export function SearchPanel({ rootPath, onOpenFile }) {
  const [query, setQuery] = useState('');
  const [replacement, setReplacement] = useState('');
  const [isRegex, setIsRegex] = useState(false);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [truncated, setTruncated] = useState(false);
  const [statusText, setStatusText] = useState('');

  const doSearch = async () => {
    if (!query.trim() || !rootPath) return;
    setLoading(true);
    setStatusText('');
    try {
      const res = await window.electronAPI.searchInFiles(rootPath, query.trim());
      setResults(res.results || []);
      setTruncated(!!res.truncated);
    } finally { setLoading(false); }
  };

  const doReplaceAll = async () => {
    if (!query.trim() || !rootPath) return;
    if (!confirm(`Apakah Anda yakin ingin mengganti semua kecocokan "${query}" dengan "${replacement}"?`)) return;
    setLoading(true);
    setStatusText('');
    try {
      const res = await window.electronAPI.searchReplaceInFiles(rootPath, query.trim(), replacement, isRegex);
      if (res.success) {
        setStatusText(`Berhasil mengganti ${res.occurencesReplaced} kecocokan di ${res.filesReplaced} berkas!`);
        setResults([]);
      } else {
        setStatusText(`Error: ${res.error}`);
      }
    } catch (e) {
      setStatusText(`Error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <PanelHeader title="Cari & Ganti" />
      <div style={{ padding: '0 12px 8px 12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '6px 8px' }}>
          <Search size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <input
            value={query} onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && doSearch()}
            placeholder="Cari..."
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: '12px' }}
          />
          <button
            onClick={() => setIsRegex(r => !r)}
            title="Regular Expression (regex)"
            style={{
              background: isRegex ? 'rgba(0, 245, 255, 0.15)' : 'transparent',
              border: 'none',
              borderRadius: '3px',
              color: isRegex ? 'var(--accent-cyan)' : 'var(--text-muted)',
              fontSize: '11px',
              fontWeight: 700,
              padding: '2px 4px',
              cursor: 'pointer',
              fontFamily: 'monospace'
            }}
          >
            .*
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '6px 8px' }}>
          <input
            value={replacement} onChange={(e) => setReplacement(e.target.value)}
            placeholder="Ganti dengan..."
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: '12px' }}
          />
          {query.trim() && (
            <button
              onClick={doReplaceAll}
              title="Ganti Semua"
              style={{
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '4px',
                color: '#f87171',
                fontSize: '10px',
                fontWeight: 700,
                padding: '3px 6px',
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              Ganti Semua
            </button>
          )}
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 4px' }}>
        {loading ? (
          <div style={{ padding: '12px', fontSize: '12px', color: 'var(--text-muted)' }}>Memproses...</div>
        ) : statusText ? (
          <div style={{ padding: '12px', fontSize: '12px', color: 'var(--accent-cyan)' }}>{statusText}</div>
        ) : results.length === 0 ? (
          <div style={{ padding: '12px', fontSize: '12px', color: 'var(--text-muted)' }}>
            {query ? 'Nggak ada hasil.' : 'Ketik kata kunci lalu Enter untuk mencari.'}
          </div>
        ) : (
          <>
            <div style={{ padding: '4px 12px', fontSize: '11px', color: 'var(--text-muted)' }}>
              {results.length} hasil{truncated ? ' (dipotong)' : ''}
            </div>
            {results.map((r, i) => (
              <div key={i} onClick={() => onOpenFile(r.file)} style={{
                padding: '6px 12px', cursor: 'pointer', borderRadius: '4px', fontSize: '12px'
              }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{ color: 'var(--accent-cyan)', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{baseName(r.file)}</span>
                  <span style={{ color: 'var(--text-muted)', flexShrink: 0, marginLeft: '6px' }}>:{r.line}</span>
                </div>
                <div style={{ color: 'var(--text-secondary)', fontFamily: 'monospace', fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.text}</div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

export function SourceControlPanel({ rootPath }) {
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState('');
  const [note, setNote] = useState('');
  const [branches, setBranches] = useState([]);

  const refresh = async () => {
    setLoading(true);
    try {
      const statusRes = await window.electronAPI.gitStatus(rootPath);
      setInfo(statusRes);
      if (statusRes && statusRes.isRepo) {
        const branchRes = await window.electronAPI.gitAction(rootPath, 'branches');
        if (branchRes && branchRes.success) {
          setBranches(branchRes.branches || []);
        }
      }
    } finally { setLoading(false); }
  };
  useEffect(() => { refresh(); }, [rootPath]);

  const doGit = async (action, opts) => {
    setBusy(action); setNote('');
    const r = await window.electronAPI.gitAction(rootPath, action, opts);
    setBusy('');
    setNote(r.success ? `✓ ${action} berhasil` : `✕ ${r.error || action + ' gagal'}`);
    if (r.success) { if (action === 'commit') setMsg(''); refresh(); }
  };

  const checkoutBranch = async (branchName) => {
    setBusy('checkout');
    setNote(`Pindah ke branch ${branchName}...`);
    const r = await window.electronAPI.gitAction(rootPath, 'checkout', { branch: branchName });
    setBusy('');
    setNote(r.success ? `✓ Berhasil pindah ke ${branchName}` : `✕ Gagal: ${r.error}`);
    refresh();
  };

  const createBranch = async () => {
    const name = prompt('Nama branch baru:');
    if (!name || !name.trim()) return;
    setBusy('create-branch');
    setNote(`Membuat branch ${name.trim()}...`);
    const r = await window.electronAPI.gitAction(rootPath, 'create-branch', { branch: name.trim() });
    setBusy('');
    setNote(r.success ? `✓ Branch ${name.trim()} dibuat & aktif` : `✕ Gagal: ${r.error}`);
    refresh();
  };

  const doStash = async () => {
    const noteText = prompt('Catatan stash (opsional):') || '';
    setBusy('stash');
    setNote('Menyimpan perubahan ke stash...');
    const r = await window.electronAPI.gitAction(rootPath, 'stash', { message: noteText });
    setBusy('');
    setNote(r.success ? `✓ Stash tersimpan` : `✕ Gagal: ${r.error}`);
    refresh();
  };

  const doStashPop = async () => {
    setBusy('stash-pop');
    setNote('Mengeluarkan stash...');
    const r = await window.electronAPI.gitAction(rootPath, 'stash-pop');
    setBusy('');
    setNote(r.success ? `✓ Stash dikeluarkan` : `✕ Gagal: ${r.error}`);
    refresh();
  };

  // Generate pesan commit dari diff pakai model lokal
  const aiCommitMsg = async () => {
    setBusy('ai'); setNote('AI nyusun pesan commit...');
    try {
      const d = await window.electronAPI.gitAction(rootPath, 'diff');
      const diff = (d.output || '').trim();
      if (!diff) { setNote('Gak ada perubahan buat di-commit'); setBusy(''); return; }
      const mdl = localStorage.getItem('nata_model') || 'qwen2.5-coder:3b';
      const res = await fetch('http://localhost:11434/api/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: mdl, stream: false, keep_alive: '30m',
          prompt: `Tulis SATU baris pesan commit git (conventional commits, bahasa Indonesia singkat, maks 70 char) untuk diff ini. JAWAB HANYA pesan commit-nya, tanpa penjelasan:\n\n${diff.slice(0, 4000)}`,
          options: { num_predict: 40, temperature: 0.2, stop: ['\n'] },
        }),
      });
      const data = await res.json();
      const m = (data.response || '').trim().replace(/^["'`]|["'`]$/g, '');
      if (m) { setMsg(m); setNote('✓ Pesan commit dibuat AI'); } else setNote('AI gagal bikin pesan');
    } catch (e) { setNote('✕ ' + e.message); }
    setBusy('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: '10px' }}>
        <PanelHeader title="Source Control" />
        <button onClick={refresh} title="Refresh" style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex' }}>
          <RefreshCw size={13} />
        </button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading ? (
          <div style={{ padding: '12px', fontSize: '12px', color: 'var(--text-muted)' }}>Memeriksa...</div>
        ) : !info?.isRepo ? (
          <div style={{ padding: '12px', fontSize: '12px', color: 'var(--text-muted)' }}>Folder ini bukan repo Git.</div>
        ) : (
          <>
            <div style={{ padding: '4px 12px 8px 12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <GitBranch size={13} style={{ color: 'var(--accent-gemma)', flexShrink: 0 }} />
              <select
                value={info.branch}
                onChange={(e) => checkoutBranch(e.target.value)}
                disabled={!!busy}
                style={{
                  background: '#0d0e13',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '5px',
                  color: '#e3e3e6',
                  fontSize: '11.5px',
                  padding: '3px 6px',
                  outline: 'none',
                  cursor: 'pointer',
                  flex: 1,
                  minWidth: 0
                }}
              >
                {branches.map(b => (
                  <option key={b.name} value={b.name}>{b.name}</option>
                ))}
              </select>
              <button
                onClick={createBranch}
                disabled={!!busy}
                title="Buat Branch Baru"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '5px',
                  color: '#e3e3e6',
                  padding: '4px 8px',
                  cursor: 'pointer',
                  fontSize: '11px',
                  fontWeight: 700,
                  whiteSpace: 'nowrap'
                }}
              >
                + New
              </button>
            </div>
            {/* Commit box + aksi */}
            <div style={{ padding: '0 12px 10px 12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', gap: '6px' }}>
                <input value={msg} onChange={e => setMsg(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && msg.trim()) doGit('commit', { message: msg.trim() }); }}
                  placeholder="Pesan commit (Enter = commit semua)"
                  style={{ flex: 1, minWidth: 0, background: '#0d0e13', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '5px', color: '#e3e3e6', fontSize: '12px', padding: '6px 8px', outline: 'none' }} />
                <button disabled={busy} onClick={aiCommitMsg} title="Generate pesan commit pakai AI"
                  style={{ flexShrink: 0, padding: '0 9px', borderRadius: '5px', border: '1px solid rgba(192,132,252,0.3)', background: 'rgba(192,132,252,0.12)', color: '#c084fc', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>
                  {busy === 'ai' ? '...' : '✨ AI'}
                </button>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button disabled={!msg.trim() || busy} onClick={() => doGit('commit', { message: msg.trim() })} style={scmBtn(true)}>{busy === 'commit' ? '...' : 'Commit'}</button>
                <button disabled={busy} onClick={() => doGit('push')} style={scmBtn(false)}>{busy === 'push' ? '...' : 'Push'}</button>
                <button disabled={busy} onClick={() => doGit('pull')} style={scmBtn(false)}>{busy === 'pull' ? '...' : 'Pull'}</button>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button disabled={!!busy} onClick={doStash} style={scmBtn(false)}>Stash</button>
                <button disabled={!!busy} onClick={doStashPop} style={scmBtn(false)}>Stash Pop</button>
              </div>
              {note && <div style={{ fontSize: '11px', color: note.startsWith('✓') ? '#34d399' : '#f87171' }}>{note}</div>}
            </div>
            {info.files.length === 0 ? (
              <div style={{ padding: '12px', fontSize: '12px', color: 'var(--text-muted)' }}>Nggak ada perubahan. Bersih ✨</div>
            ) : (
              info.files.map((f, i) => (
                <div key={i} style={{ padding: '5px 12px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                  <span style={{ width: '18px', textAlign: 'center', color: 'var(--accent-cyan)', fontFamily: 'monospace', fontWeight: 700 }}>{f.status || 'M'}</span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>{f.path}</span>
                </div>
              ))
            )}
          </>
        )}
      </div>
    </div>
  );
}

const scmBtn = (primary) => ({
  flex: 1, padding: '5px 8px', borderRadius: '5px', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer',
  background: primary ? 'linear-gradient(135deg, var(--accent-gemma), var(--accent-cyan))' : 'rgba(255,255,255,0.05)',
  color: primary ? '#050508' : 'var(--text-secondary)',
  border: primary ? 'none' : '1px solid rgba(255,255,255,0.1)',
});

// --- Skills Panel -------------------------------------------------------
const BUILTIN_SKILLS = [
  { name: 'review',   description: 'Code review menyeluruh — temukan bug, security, performa', builtin: true },
  { name: 'explain',  description: 'Jelaskan kode dengan bahasa mudah', builtin: true },
  { name: 'fix',      description: 'Perbaiki bug yang ditemukan di kode', builtin: true },
  { name: 'optimize', description: 'Optimisasi performa kode', builtin: true },
  { name: 'test',     description: 'Buatkan unit tests yang komprehensif', builtin: true },
  { name: 'refactor', description: 'Refactor kode agar lebih clean dan maintainable', builtin: true },
];

export function SkillsPanel({ workspaceRoot, onSkillsChange }) {
  const [skills, setSkills]           = useState([]);
  const [loading, setLoading]         = useState(false);
  const [installUrl, setInstallUrl]   = useState('');
  const [installing, setInstalling]   = useState(false);
  const [installMsg, setInstallMsg]   = useState('');
  const [showCreate, setShowCreate]   = useState(false);
  const [newName, setNewName]         = useState('');
  const [newDesc, setNewDesc]         = useState('');
  const [newPrompt, setNewPrompt]     = useState('');
  const [showInstall, setShowInstall] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await window.electronAPI.listSkills(workspaceRoot);
      setSkills(res.skills || []);
      onSkillsChange?.(res.skills || []);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [workspaceRoot]);

  const doInstall = async () => {
    if (!installUrl.trim()) return;
    setInstalling(true);
    setInstallMsg('Cloning...');
    const res = await window.electronAPI.installSkill(installUrl.trim(), workspaceRoot);
    if (res.success) {
      setInstallMsg(`✓ ${res.count} skill terpasang!`);
      setInstallUrl('');
      await load();
    } else {
      setInstallMsg(`✕ ${res.error}`);
    }
    setInstalling(false);
    setTimeout(() => setInstallMsg(''), 4000);
  };

  const doCreate = async () => {
    if (!newName.trim() || !newPrompt.trim()) return;
    const res = await window.electronAPI.createSkill(newName, newDesc, newPrompt, workspaceRoot);
    if (res.success) { setShowCreate(false); setNewName(''); setNewDesc(''); setNewPrompt(''); await load(); }
  };

  const doDelete = async (skill) => {
    if (!skill.filePath) return;
    await window.electronAPI.deleteSkill(skill.filePath);
    await load();
  };

  const inputStyle = {
    width: '100%', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)',
    borderRadius: '5px', color: 'var(--text-primary)', padding: '5px 8px', fontSize: '12px', outline: 'none'
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 12px 6px 12px' }}>
        <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Skills</span>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button onClick={() => { setShowInstall(v => !v); setShowCreate(false); }} title="Install dari GitHub" style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}>
            <Download size={13} />
          </button>
          <button onClick={() => { setShowCreate(v => !v); setShowInstall(false); }} title="Buat skill baru" style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}>
            <Plus size={13} />
          </button>
          <button onClick={load} title="Refresh" style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}>
            <RefreshCw size={12} />
          </button>
        </div>
      </div>

      {/* Install dari GitHub */}
      {showInstall && (
        <div style={{ padding: '0 12px 8px 12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>URL repo GitHub / .md:</div>
          <input value={installUrl} onChange={e => setInstallUrl(e.target.value)} placeholder="https://github.com/user/skills-repo" style={inputStyle} onKeyDown={e => e.key === 'Enter' && doInstall()} />
          <button onClick={doInstall} disabled={installing} style={{ background: 'rgba(0,245,255,0.1)', border: '1px solid rgba(0,245,255,0.25)', borderRadius: '5px', color: 'var(--accent-cyan)', fontSize: '11px', fontWeight: 700, padding: '4px 10px', cursor: installing ? 'default' : 'pointer', opacity: installing ? 0.6 : 1 }}>
            {installing ? 'Menginstall...' : '↓ Install'}
          </button>
          {installMsg && <div style={{ fontSize: '11px', color: installMsg.startsWith('✓') ? '#34d399' : '#f87171' }}>{installMsg}</div>}
        </div>
      )}

      {/* Buat skill baru */}
      {showCreate && (
        <div style={{ padding: '0 12px 8px 12px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Nama skill (contoh: fix-api)" style={inputStyle} />
          <input value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Deskripsi singkat" style={inputStyle} />
          <textarea value={newPrompt} onChange={e => setNewPrompt(e.target.value)} placeholder="Isi prompt / instruksi untuk AI..." rows={4} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
          <div style={{ display: 'flex', gap: '6px' }}>
            <button onClick={doCreate} style={{ background: 'rgba(138,43,226,0.15)', border: '1px solid rgba(138,43,226,0.3)', borderRadius: '5px', color: '#c996ff', fontSize: '11px', fontWeight: 700, padding: '4px 10px', cursor: 'pointer' }}>Simpan</button>
            <button onClick={() => setShowCreate(false)} style={{ background: 'transparent', border: '1px solid var(--border-color)', borderRadius: '5px', color: 'var(--text-muted)', fontSize: '11px', padding: '4px 10px', cursor: 'pointer' }}>Batal</button>
          </div>
        </div>
      )}

      {/* Divider */}
      <div style={{ borderTop: '1px solid var(--border-color)', margin: '0 12px', flexShrink: 0 }} />

      <div style={{ flex: 1, overflowY: 'auto', padding: '6px 0' }}>
        {/* Built-in skills */}
        <div style={{ padding: '4px 12px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.06em' }}>Built-in</div>
        {BUILTIN_SKILLS.map(s => (
          <div key={s.name} style={{ padding: '5px 12px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'default' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <Zap size={11} style={{ color: '#fbbf24', flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '12px', color: 'var(--text-primary)', fontWeight: 600 }}>/{s.name}</div>
              <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.description}</div>
            </div>
          </div>
        ))}

        {/* Installed skills */}
        {skills.length > 0 && (
          <>
            <div style={{ padding: '8px 12px 4px 12px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.06em' }}>
              Installed ({skills.length})
            </div>
            {loading ? (
              <div style={{ padding: '8px 12px', fontSize: '12px', color: 'var(--text-muted)' }}>Memuat...</div>
            ) : skills.map((s, i) => (
              <div key={i} style={{ padding: '5px 12px', display: 'flex', alignItems: 'center', gap: '8px' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <Zap size={11} style={{ color: 'var(--accent-cyan)', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-primary)', fontWeight: 600 }}>/{s.name}</div>
                  <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.description || s.scope}</div>
                </div>
                <button onClick={() => doDelete(s)} title="Hapus" style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', opacity: 0.5, flexShrink: 0 }}
                  onMouseEnter={e => e.currentTarget.style.opacity = 1}
                  onMouseLeave={e => e.currentTarget.style.opacity = 0.5}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </>
        )}

        {/* Tip buat pakai skill */}
        <div style={{ margin: '12px 12px 0 12px', padding: '8px 10px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
          Ketik <span style={{ color: 'var(--accent-cyan)', fontWeight: 700, fontFamily: 'monospace' }}>/</span> di chat buat pilih skill
        </div>
      </div>
    </div>
  );
}

// --- Placeholder buat Run & Extensions ----------------------------------
export function PlaceholderPanel({ title, note }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <PanelHeader title={title} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '20px', color: 'var(--text-muted)', textAlign: 'center' }}>
        <Construction size={28} />
        <div style={{ fontSize: '12px', lineHeight: 1.5 }}>{note}</div>
      </div>
    </div>
  );
}
