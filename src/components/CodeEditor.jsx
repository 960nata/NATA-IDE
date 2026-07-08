import React, { useState, useEffect, useRef } from 'react';
import { Save, FileCode, Eye, Code2, Sparkles } from 'lucide-react';
import Editor from '@monaco-editor/react';
import ReactMarkdown from 'react-markdown';
import { langFromPath } from '../monacoSetup';

// Daftar provider tab-autocomplete (ghost text) pakai model lokal lewat Ollama FIM. Sekali aja.
let _inlineRegistered = false;
function registerInlineCompletions(monaco) {
  if (_inlineRegistered) return;
  _inlineRegistered = true;
  const langs = ['javascript', 'typescript', 'python', 'go', 'rust', 'java', 'cpp', 'c', 'csharp', 'php', 'ruby', 'html', 'css', 'scss', 'json', 'yaml', 'shell'];
  monaco.languages.registerInlineCompletionsProvider(langs, {
    async provideInlineCompletions(model, position, context, token) {
      if (localStorage.getItem('nata_autocomplete') === 'off') return { items: [] };
      // FIM cuma dimengerti keluarga qwen-coder — model lain (qwen3-instruct dll) bakal
      // inferensi sia-sia tiap ketikan = MacBook panas. Skip.
      const mdlCheck = localStorage.getItem('nata_model') || 'qwen2.5-coder:3b';
      if (!/coder/i.test(mdlCheck)) return { items: [] };
      await new Promise(r => setTimeout(r, 700)); // debounce gede — hemat inferensi & panas
      if (token.isCancellationRequested) return { items: [] };
      const before = model.getValueInRange({ startLineNumber: Math.max(1, position.lineNumber - 60), startColumn: 1, endLineNumber: position.lineNumber, endColumn: position.column });
      const lastLine = model.getLineCount();
      const after = model.getValueInRange({ startLineNumber: position.lineNumber, startColumn: position.column, endLineNumber: Math.min(lastLine, position.lineNumber + 20), endColumn: model.getLineMaxColumn(Math.min(lastLine, position.lineNumber + 20)) });
      const prefix = before.slice(-2000);
      const suffix = after.slice(0, 600);
      try {
        const mdl = localStorage.getItem('nata_model') || 'qwen2.5-coder:3b';
        const res = await fetch('http://localhost:11434/api/generate', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: mdl,
            prompt: `<|fim_prefix|>${prefix}<|fim_suffix|>${suffix}<|fim_middle|>`,
            raw: true, stream: false,
            options: { num_predict: 96, temperature: 0.1, top_p: 0.9, stop: ['<|fim_pad|>', '<|endoftext|>', '<|fim_prefix|>', '<|fim_suffix|>', '<|repo_name|>'] },
            keep_alive: '4m', // JANGAN 30m — nge-override Eco, model nginep di RAM & bikin panas
          }),
        });
        if (token.isCancellationRequested) return { items: [] };
        const data = await res.json();
        const text = (data.response || '').replace(/<\|[^|]*\|>/g, '');
        if (!text.trim()) return { items: [] };
        return { items: [{ insertText: text, range: new monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column) }] };
      } catch { return { items: [] }; }
    },
    freeInlineCompletions() {},
  });
}

export default function CodeEditor({ filePath, onFileSaved, reloadSignal, wordWrap = true, workspaceRoot }) {
  const [content, setContent] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  const contentRef = useRef('');
  const dirtyRef = useRef(false);
  const [pos, setPos] = useState({ line: 1, col: 1 });
  const [preview, setPreview] = useState(false);
  const [aiEditing, setAiEditing] = useState(false);
  const [explain, setExplain] = useState(null); // {loading, text} — modal AI explain
  const isMd = /\.(md|markdown)$/i.test(filePath || '');
  const isHtml = /\.html?$/i.test(filePath || '');
  const canPreview = isMd || isHtml;

  const blameDecorationsRef = useRef([]);
  const blameTimeoutRef = useRef(null);

  // Diagnostics → squiggly markers di editor (garis merah error / kuning warning)
  useEffect(() => {
    const apply = (list) => {
      const ed = editorRef.current, mon = monacoRef.current;
      const model = ed?.getModel?.();
      if (!model || !mon || !filePath) return;
      const mine = (list || []).filter(d => d.file && (filePath === d.file || filePath.endsWith('/' + d.file)));
      mon.editor.setModelMarkers(model, 'nata-diag', mine.map(d => ({
        severity: d.type === 'error' ? mon.MarkerSeverity.Error : mon.MarkerSeverity.Warning,
        message: `[${d.source || 'lint'}] ${d.message}`,
        startLineNumber: d.line || 1, startColumn: d.col || 1,
        endLineNumber: d.line || 1, endColumn: (d.col || 1) + 30,
      })));
    };
    const h = (e) => apply(e.detail);
    window.addEventListener('nata-diagnostics', h);
    const t = setTimeout(() => apply(window.__nataDiag), 700); // file baru dibuka → pasang markers terakhir
    return () => { clearTimeout(t); window.removeEventListener('nata-diagnostics', h); };
  }, [filePath]);

  // Lompat ke baris tertentu (dari klik problem di Problems panel)
  useEffect(() => {
    const h = (e) => {
      const { path, line, col } = e.detail || {};
      if (!path || path !== filePath) return;
      let tries = 0;
      const jump = () => {
        const ed = editorRef.current;
        // Editor/file bisa masih loading — retry bentar sampai siap
        if (!ed || (ed.getModel()?.getLineCount() || 0) < (line || 1)) {
          if (++tries < 12) setTimeout(jump, 150);
          return;
        }
        ed.revealLineInCenter(line || 1);
        ed.setPosition({ lineNumber: line || 1, column: col || 1 });
        ed.focus();
      };
      jump();
    };
    window.addEventListener('nata-goto-line', h);
    return () => window.removeEventListener('nata-goto-line', h);
  }, [filePath]);

  const showBlameDecoration = async (lineNumber) => {
    if (!editorRef.current || !monacoRef.current || !filePath || !workspaceRoot) return;
    try {
      const res = await window.electronAPI.gitBlame(workspaceRoot, filePath, lineNumber);
      if (res && res.success) {
        const { author, summary, time } = res;
        const blameMsg = `    ${author} • ${time} • "${summary}"`;
        const lineLength = editorRef.current.getModel().getLineMaxColumn(lineNumber);
        const range = new monacoRef.current.Range(lineNumber, lineLength, lineNumber, lineLength);
        
        const newDecorations = [{
          range: range,
          options: {
            isWholeLine: false,
            after: {
              content: blameMsg,
              inlineClassName: 'monaco-git-blame-inline'
            }
          }
        }];
        
        blameDecorationsRef.current = editorRef.current.deltaDecorations(
          blameDecorationsRef.current,
          newDecorations
        );
      } else {
        blameDecorationsRef.current = editorRef.current.deltaDecorations(blameDecorationsRef.current, []);
      }
    } catch (err) {
      if (editorRef.current) {
        blameDecorationsRef.current = editorRef.current.deltaDecorations(blameDecorationsRef.current, []);
      }
    }
  };

  useEffect(() => {
    if (!editorRef.current || !monacoRef.current || !filePath || !workspaceRoot) return;
    if (localStorage.getItem('nata_git_blame') === 'off') {
      if (blameDecorationsRef.current.length > 0) {
        blameDecorationsRef.current = editorRef.current.deltaDecorations(blameDecorationsRef.current, []);
      }
      return;
    }

    if (blameTimeoutRef.current) clearTimeout(blameTimeoutRef.current);
    blameTimeoutRef.current = setTimeout(() => {
      showBlameDecoration(pos.line);
    }, 400);

    return () => {
      if (blameTimeoutRef.current) clearTimeout(blameTimeoutRef.current);
    };
  }, [pos.line, filePath, workspaceRoot]);

  // Clean up decorations on file change
  useEffect(() => {
    return () => {
      if (editorRef.current && blameDecorationsRef.current.length > 0) {
        try {
          blameDecorationsRef.current = editorRef.current.deltaDecorations(blameDecorationsRef.current, []);
        } catch (e) {}
      }
    };
  }, [filePath]);

  // Load file content
  useEffect(() => {
    if (!filePath) { setContent(''); setIsDirty(false); return; }
    let cancelled = false;
    (async () => {
      setLoading(true); setError('');
      try {
        const res = await window.electronAPI.readFile(filePath);
        if (cancelled) return;
        if (res.success) { setContent(res.content); contentRef.current = res.content; setIsDirty(false); dirtyRef.current = false; }
        else setError(res.error || 'Gagal baca file');
      } catch (err) { if (!cancelled) setError(err.message); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [filePath, reloadSignal]);

  const handleSave = async () => {
    if (!filePath) return;
    const formatOnSave = localStorage.getItem('nata_format_on_save') === 'on';
    if (formatOnSave && editorRef.current) {
      try {
        await editorRef.current.getAction('editor.action.formatDocument')?.run();
        const updatedVal = editorRef.current.getValue();
        contentRef.current = updatedVal;
        setContent(updatedVal);
      } catch (e) {
        console.warn('Format on save failed:', e);
      }
    }
    setSaving(true);
    try {
      const res = await window.electronAPI.writeFile(filePath, contentRef.current);
      if (res.success) { setIsDirty(false); dirtyRef.current = false; onFileSaved?.(filePath); }
      else alert('Gagal menyimpan: ' + res.error);
    } catch (err) { alert('Error simpan: ' + err.message); }
    finally { setSaving(false); }
  };

  const onChange = (val) => {
    const v = val ?? '';
    setContent(v); contentRef.current = v;
    if (!dirtyRef.current) { dirtyRef.current = true; setIsDirty(true); }
  };

  const onMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    // Cmd/Ctrl+S simpan
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => handleSave());
    editor.onDidChangeCursorPosition(e => setPos({ line: e.position.lineNumber, col: e.position.column }));
    registerInlineCompletions(monaco); // tab-autocomplete pakai qwen
    // Outline / Go to Symbol (Cmd+Shift+O) & Format Document (Shift+Alt+F) — bawaan Monaco
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyO, () => editor.getAction('editor.action.quickOutline')?.run());
    editor.addCommand(monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.KeyF, () => editor.getAction('editor.action.formatDocument')?.run());
    // Cmd+E → AI explain seleksi (atau seluruh file)
    const aiExplain = async () => {
      const model = editor.getModel();
      const sel = editor.getSelection();
      const code = model.getValueInRange(sel) || model.getValue();
      if (!code.trim()) return;
      setExplain({ loading: true, text: '' });
      try {
        const mdl = localStorage.getItem('nata_model') || 'qwen2.5-coder:3b';
        const res = await fetch('http://localhost:11434/api/generate', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: mdl, stream: false, keep_alive: '30m',
            prompt: `Jelaskan kode ini dengan bahasa Indonesia yang mudah dipahami, singkat & poin-poin:\n\n${code.slice(0, 4000)}`,
            options: { num_predict: 512, temperature: 0.3 } }),
        });
        const data = await res.json();
        setExplain({ loading: false, text: (data.response || 'Gagal menjelaskan').trim() });
      } catch (e) { setExplain({ loading: false, text: 'Error: ' + e.message }); }
    };
    // Cmd+I → AI inline edit (ala Cursor): seleksi kode → instruksi → qwen rewrite di tempat
    const aiInlineEdit = async () => {
      const sel = editor.getSelection();
      const model = editor.getModel();
      const selected = model.getValueInRange(sel);
      const target = selected || model.getValue();
      const isEmpty = !target.trim();
      const instruction = window.prompt(
        isEmpty 
          ? 'AI Tulis — Mau buat kode apa di file kosong ini?' 
          : 'AI Edit — Apa yang mau diubah dari kode ini?'
      );
      if (!instruction) return;
      setAiEditing(true);
      try {
        const mdl = localStorage.getItem('nata_model') || 'qwen2.5-coder:3b';
        const res = await fetch('http://localhost:11434/api/generate', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: mdl, stream: false, keep_alive: '30m',
            prompt: isEmpty 
              ? `Kamu editor kode profesional. Tulis kode baru dari awal sesuai instruksi user.

ATURAN KETAT:
- Jawab HANYA kode hasil akhirnya
- JANGAN tulis penjelasan, komentar tambahan, atau kata-kata di luar kode
- JANGAN bungkus dalam markdown fence (\`\`\`)
- JANGAN tulis "Berikut kode..." atau pengantar apapun
- Langsung mulai dari baris pertama kode

Instruksi: ${instruction}`
              : `Kamu editor kode profesional. Ubah kode di bawah sesuai instruksi user.

ATURAN KETAT:
- Jawab HANYA kode hasil akhirnya
- JANGAN tulis penjelasan, komentar tambahan, atau kata-kata di luar kode
- JANGAN bungkus dalam markdown fence (\`\`\`)
- JANGAN tulis "Berikut kode..." atau pengantar apapun
- Langsung mulai dari baris pertama kode

Instruksi: ${instruction}

Kode yang harus diubah:
${target.slice(0, 6000)}`,
            options: { num_predict: 2048, temperature: 0.2, num_ctx: 8192 },
          }),
        });
        const data = await res.json();
        let out = (data.response || '').trim();
        // Strip markdown fence dengan berbagai format (```js, ```javascript, ```, dll)
        out = out.replace(/^```[\w]*\s*\n?/, '').replace(/\n?\s*```\s*$/, '');
        // Strip juga kalau ada fence di tengah (model kadang wrap ulang)
        if (out.startsWith('```')) out = out.replace(/^```[\w]*\s*\n?/, '');
        if (out.endsWith('```')) out = out.replace(/\n?\s*```\s*$/, '');
        // Strip leading prose ("Berikut...", "Here is...")
        out = out.replace(/^(Berikut|Here is|Di bawah|Below|The following)[^\n]*\n+/i, '');
        if (out) {
          const range = selected ? sel : model.getFullModelRange();
          editor.executeEdits('ai-inline', [{ range, text: out }]);
        }
      } catch (e) { alert('AI edit gagal: ' + e.message); }
      setAiEditing(false);
    };
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyE, aiExplain);
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyI, aiInlineEdit);
    // Klik kanan di editor → aksi AI ala Cursor (grup paling atas di context menu)
    editor.addAction({ id: 'nata-ai-edit', label: '✨ AI Edit seleksi ini (⌘I)', contextMenuGroupId: '0_nata', contextMenuOrder: 1, run: aiInlineEdit });
    editor.addAction({ id: 'nata-ai-explain', label: '✨ AI Jelasin kode ini (⌘E)', contextMenuGroupId: '0_nata', contextMenuOrder: 2, run: aiExplain });
    editor.addAction({
      id: 'nata-ai-fix', label: '✨ Kirim ke Chat buat difix', contextMenuGroupId: '0_nata', contextMenuOrder: 3,
      run: (ed) => {
        const s = ed.getModel().getValueInRange(ed.getSelection()) || '';
        if (!s.trim()) return;
        window.dispatchEvent(new CustomEvent('nata-chat-prompt', { detail: `Perbaiki/refactor potongan kode ini${filePath ? ` dari file ${filePath.split('/').pop()}` : ''}:\n\n\`\`\`\n${s.slice(0, 3000)}\n\`\`\`` }));
      }
    });
    editor.focus();
  };

  const getFileName = () => filePath ? filePath.split('/').pop() : '';

  if (!filePath) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', background: 'rgba(9,10,15,0.2)', padding: '40px', textAlign: 'center' }}>
        <div style={{ width: '64px', height: '64px', borderRadius: '50%', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
          <FileCode size={32} />
        </div>
        <h3 style={{ color: 'var(--text-secondary)', fontWeight: 600, fontSize: '15px' }}>Tidak Ada Berkas Terbuka</h3>
        <p style={{ fontSize: '12px', marginTop: '6px', maxWidth: '300px', lineHeight: 1.5 }}>
          Pilih berkas dari File Explorer, atau minta Nata Agent bikin berkas baru.
        </p>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', background: '#1e1e1e', minWidth: 0 }}>
      {/* Header */}
      <div style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', background: 'rgba(17,19,28,0.4)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{getFileName()}</span>
          {isDirty && <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--accent-magenta)', flexShrink: 0 }} />}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          {filePath && !/\.(png|jpg|jpeg|gif|webp|svg|bmp|pdf|docx|pptx|xlsx)$/i.test(filePath) && (
            <button
              onClick={() => {
                window.dispatchEvent(new CustomEvent('nata-chat-prompt', { 
                  detail: `Tolong buatkan unit test yang komprehensif untuk file \`${getFileName()}\` ini. Pastikan test mencakup berbagai skenario:\n\n\`\`\`\n${contentRef.current}\n\`\`\`` 
                }));
              }}
              title="Generate unit test pakai AI"
              style={{
                display: 'flex', alignItems: 'center', gap: '5px', background: 'rgba(139,92,246,0.12)',
                border: '1px solid rgba(139,92,246,0.3)', borderRadius: '6px', padding: '5px 10px', fontSize: '11px', fontWeight: 700,
                color: '#c084fc', cursor: 'pointer',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(139,92,246,0.2)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(139,92,246,0.12)'}
            >
              <Sparkles size={12} /> Generate Test
            </button>
          )}
          {canPreview && (
            <button onClick={() => setPreview(p => !p)} title="Toggle preview" style={{
              display: 'flex', alignItems: 'center', gap: '5px', background: preview ? 'rgba(96,165,250,0.15)' : 'transparent',
              border: '1px solid var(--border-color)', borderRadius: '6px', padding: '5px 10px', fontSize: '11px', fontWeight: 700,
              color: preview ? '#60a5fa' : 'var(--text-muted)', cursor: 'pointer',
            }}>
              {preview ? <Code2 size={12} /> : <Eye size={12} />} {preview ? 'Kode' : 'Preview'}
            </button>
          )}
          <button onClick={handleSave} disabled={!isDirty || saving} style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            background: isDirty ? 'linear-gradient(135deg, var(--accent-gemma), var(--accent-cyan))' : 'transparent',
            color: isDirty ? '#050508' : 'var(--text-muted)', border: isDirty ? 'none' : '1px solid var(--border-color)',
            borderRadius: '6px', padding: '5px 12px', fontSize: '12px', fontWeight: 700, cursor: isDirty && !saving ? 'pointer' : 'default',
          }}>
            <Save size={13} /> {saving ? 'Saving...' : 'Simpan'}
          </button>
        </div>
      </div>

      {/* Monaco / preview */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {error ? (
          <div style={{ padding: '20px', color: 'var(--accent-magenta)', fontSize: '12px' }}>{error}</div>
        ) : (isMd && preview) ? (
          <div className="md-body sel" style={{ height: '100%', overflowY: 'auto', padding: '20px 28px', color: '#e3e3e6' }}>
            <ReactMarkdown>{content}</ReactMarkdown>
          </div>
        ) : (isHtml && preview) ? (
          <iframe title="preview" srcDoc={content} sandbox="allow-scripts allow-same-origin"
            style={{ width: '100%', height: '100%', border: 'none', background: '#fff' }} />
        ) : (
          <Editor
            height="100%"
            theme={localStorage.getItem('nata_editor_theme') || 'vs-dark'}
            language={langFromPath(filePath)}
            value={content}
            onChange={onChange}
            onMount={onMount}
            loading={<div style={{ padding: '20px', color: '#718096', fontSize: '12px' }}>Memuat editor...</div>}
            options={{
              fontSize: 13,
              fontFamily: '"JetBrains Mono", Menlo, monospace',
              minimap: { enabled: localStorage.getItem('nata_minimap') !== 'off' },
              stickyScroll: { enabled: localStorage.getItem('nata_sticky_scroll') !== 'off' },
              automaticLayout: true,
              scrollBeyondLastLine: false,
              tabSize: 2,
              wordWrap: wordWrap ? 'on' : 'off',
              bracketPairColorization: { enabled: true },
              inlineSuggest: { enabled: true }, // ghost text tab-autocomplete
              cursorBlinking: 'smooth',
              smoothScrolling: true,
              padding: { top: 10 },
              renderWhitespace: 'selection',
              suggestOnTriggerCharacters: true,
              quickSuggestions: true,
            }}
          />
        )}
      </div>

      {/* Modal AI Explain */}
      {explain && (
        <div onClick={() => setExplain(null)} style={{ position: 'absolute', inset: 0, zIndex: 30, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px' }}>
          <div onClick={e => e.stopPropagation()} className="md-body sel" style={{ background: '#1d1d22', border: '1px solid rgba(192,132,252,0.3)', borderRadius: '10px', padding: '20px 24px', maxWidth: '620px', maxHeight: '70%', overflowY: 'auto', color: '#e3e3e6', fontSize: '13px', lineHeight: 1.6, boxShadow: '0 16px 48px rgba(0,0,0,0.6)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <strong style={{ color: '#c084fc' }}>✨ Penjelasan AI</strong>
              <button onClick={() => setExplain(null)} style={{ background: 'transparent', border: 'none', color: '#8e8e93', cursor: 'pointer', fontSize: '16px' }}>✕</button>
            </div>
            {explain.loading ? <div style={{ color: '#718096' }}>AI lagi mikir...</div> : <ReactMarkdown>{explain.text}</ReactMarkdown>}
          </div>
        </div>
      )}

      {/* Status bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '3px 14px', borderTop: '1px solid var(--border-color)', background: 'rgba(17,19,28,0.5)', fontSize: '11px', color: '#718096', flexShrink: 0, fontFamily: '"JetBrains Mono", monospace' }}>
        <span style={{ flex: 1, color: aiEditing ? '#c084fc' : '#5f6475' }}>{aiEditing ? '✨ AI lagi ngedit...' : '⌘I edit · ⌘E jelasin · ⌘P cari file · Tab autocomplete'}</span>
        <span>Ln {pos.line}, Col {pos.col}</span>
        <span style={{ textTransform: 'uppercase' }}>{langFromPath(filePath)}</span>
        {isDirty && <span style={{ color: '#fbbf24' }}>● belum disimpan</span>}
      </div>
      <style>{`
        .monaco-git-blame-inline {
          color: var(--text-muted, #718096);
          opacity: 0.55;
          font-size: 11px;
          font-style: italic;
          margin-left: 24px;
        }
      `}</style>
    </div>
  );
}
