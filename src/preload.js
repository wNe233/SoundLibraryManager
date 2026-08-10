const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('soundLibrary', {
  chooseAudioFiles: () => ipcRenderer.invoke('library:chooseAudioFiles'),
  chooseFolder: () => ipcRenderer.invoke('library:chooseFolder'),
  scanDroppedPaths: (paths) => ipcRenderer.invoke('library:scanDroppedPaths', paths),
  revealFile: (filePath) => ipcRenderer.invoke('file:reveal', filePath),
  fileExists: (filePath) => ipcRenderer.invoke('file:exists', filePath),
  readAudioFile: (filePath) => ipcRenderer.invoke('file:readAudio', filePath),
  fileHash: (filePath) => ipcRenderer.invoke('file:hash', filePath),
  fileUrl: (filePath) => ipcRenderer.invoke('file:url', filePath),
  platform: () => ipcRenderer.invoke('app:platform'),
  loadLibrary: () => ipcRenderer.invoke('storage:loadLibrary'),
  saveLibrary: (data) => ipcRenderer.invoke('storage:saveLibrary', data),
  loadWaveCache: (key) => ipcRenderer.invoke('storage:loadWaveCache', key),
  saveWaveCache: (key, data) => ipcRenderer.invoke('storage:saveWaveCache', key, data),
  getCacheInfo: () => ipcRenderer.invoke('storage:getCacheInfo'),
  chooseLibraryDir: () => ipcRenderer.invoke('storage:chooseLibraryDir'),
  clearWaveCache: () => ipcRenderer.invoke('storage:clearWaveCache'),
  chooseWaveCacheDir: () => ipcRenderer.invoke('storage:chooseWaveCacheDir'),
  importToDaVinci: (filePath) => ipcRenderer.invoke('resolve:importMedia', filePath),
  startDrag: (filePath) => ipcRenderer.send('file:startDrag', filePath),
  pathForFile: (file) => webUtils.getPathForFile(file) || file.path || ''
});
