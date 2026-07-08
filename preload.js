const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // ---- TTS mode Suara (say bawaan macOS) ----
  speak: (text, voice, interrupt = true) => ipcRenderer.invoke('tts-speak', { text, voice, interrupt }),
  stopSpeak: () => ipcRenderer.invoke('tts-stop'),
  ttsVoices: () => ipcRenderer.invoke('tts-voices'),
  transcribe: (b64, ext = 'webm') => ipcRenderer.invoke('stt-transcribe', { b64, ext }),

  executeCommand: (command, cwd, processId) =>
    ipcRenderer.invoke('execute-command', { command, cwd, processId }),
  
  killCommand: (processId) =>
    ipcRenderer.invoke('kill-command', { processId }),

  sendStdin: (processId, data) =>
    ipcRenderer.invoke('send-stdin', { processId, data }),
  
  readFile: (filePath) =>
    ipcRenderer.invoke('read-file', { filePath }),

  readImage: (filePath) =>
    ipcRenderer.invoke('read-image', { filePath }),

  writeFile: (filePath, content) =>
    ipcRenderer.invoke('write-file', { filePath, content }),
  
  readDir: (dirPath) =>
    ipcRenderer.invoke('read-dir', { dirPath }),

  makeDir: (dirPath) =>
    ipcRenderer.invoke('fs-mkdir', { dirPath }),

  createFile: (filePath) =>
    ipcRenderer.invoke('fs-create-file', { filePath }),

  renamePath: (oldPath, newPath) =>
    ipcRenderer.invoke('fs-rename', { oldPath, newPath }),

  deletePath: (targetPath) =>
    ipcRenderer.invoke('fs-delete', { targetPath }),

  listFiles: (root) =>
    ipcRenderer.invoke('list-files', { root }),

  revealPath: (targetPath) =>
    ipcRenderer.invoke('fs-reveal', { targetPath }),

  duplicatePath: (targetPath) =>
    ipcRenderer.invoke('fs-duplicate', { targetPath }),
  
  getSystemInfo: () =>
    ipcRenderer.invoke('get-system-info'),

  runTool: (name, args, cwd) =>
    ipcRenderer.invoke('run-tool', { name, args, cwd }),

  openFolder: () =>
    ipcRenderer.invoke('open-folder'),

  searchInFiles: (root, query) =>
    ipcRenderer.invoke('search-in-files', { root, query }),

  searchReplaceInFiles: (root, query, replacement, regex) =>
    ipcRenderer.invoke('search-replace-in-files', { root, query, replacement, regex }),

  copyPath: (src, dest) =>
    ipcRenderer.invoke('fs-copy', { src, dest }),

  gitBlame: (root, filePath, line) =>
    ipcRenderer.invoke('git-blame', { root, filePath, line }),

  gitStatus: (root) =>
    ipcRenderer.invoke('git-status', { root }),

  gitAction: (root, action, opts = {}) =>
    ipcRenderer.invoke('git-action', { root, action, ...opts }),

  cloneRepo: (url, dest) =>
    ipcRenderer.invoke('clone-repo', { url, dest }),

  webFetch: (url) =>
    ipcRenderer.invoke('web-fetch', { url }),

  webSearch: (query) =>
    ipcRenderer.invoke('web-search', { query }),

  checkUpdate: (feedUrl) =>
    ipcRenderer.invoke('check-update', { feedUrl }),

  openExternal: (url) =>
    ipcRenderer.invoke('open-external', { url }),

  listSkills: (workspaceRoot) =>
    ipcRenderer.invoke('list-skills', { workspaceRoot }),

  installSkill: (url, workspaceRoot) =>
    ipcRenderer.invoke('install-skill', { url, workspaceRoot }),

  createSkill: (name, description, prompt, workspaceRoot) =>
    ipcRenderer.invoke('create-skill', { name, description, prompt, workspaceRoot }),

  deleteSkill: (filePath) =>
    ipcRenderer.invoke('delete-skill', { filePath }),

  cancelTool: () =>
    ipcRenderer.invoke('cancel-tool'),

  onToolProgress: (callback) => {
    const listener = (event, msg) => callback(msg);
    ipcRenderer.on('tool-progress', listener);
    return () => ipcRenderer.removeListener('tool-progress', listener);
  },

  // Event Listeners for running processes
  onTerminalOut: (processId, callback) => {
    const channel = `terminal-out-${processId}`;
    const listener = (event, data) => callback(data);
    ipcRenderer.on(channel, listener);
    // Return cleanup function
    return () => ipcRenderer.removeListener(channel, listener);
  },

  onTerminalErr: (processId, callback) => {
    const channel = `terminal-err-${processId}`;
    const listener = (event, data) => callback(data);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  },

  onTerminalClose: (processId, callback) => {
    const channel = `terminal-close-${processId}`;
    const listener = (event, code) => callback(code);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  },

  // Filesystem watcher — mulai pantau workspace dari main process
  watchWorkspace: (dirPath) =>
    ipcRenderer.invoke('watch-workspace', { dirPath }),

  // Daftarkan callback yang dipanggil saat isi workspace berubah
  onWorkspaceChanged: (callback) => {
    const listener = (event, payload) => callback(payload);
    ipcRenderer.on('workspace-changed', listener);
    // Kembalikan fungsi cleanup agar bisa dihapus dari useEffect
    return () => ipcRenderer.removeListener('workspace-changed', listener);
  },
});
