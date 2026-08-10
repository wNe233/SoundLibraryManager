const { app, BrowserWindow, clipboard, dialog, ipcMain, nativeImage, nativeTheme } = require('electron');
const { execFile, spawn } = require('child_process');
const fsSync = require('fs');
const fs = require('fs/promises');
const crypto = require('crypto');
const path = require('path');
const { pathToFileURL } = require('url');

const AUDIO_EXTENSIONS = new Set(['.wav', '.mp3', '.aiff', '.aif', '.m4a', '.flac']);
let appSettingsFile = null;
let appSettings = {};
let storageDir = null;
let libraryFile = null;
let waveCacheDir = null;
let configFile = null;
let appConfig = {};
let nativeFileDrag = null;
let librarySaveChain = Promise.resolve();
const DRAG_ICON = nativeImage.createFromDataURL(
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAAAXNSR0IArs4c6QAAAYNJREFUeF7tmsFtwzAMQ8l2kLYJOkE7STpBO0E7STpBO0E7QTuBOkE6QTqBOkE8YJJHSXKQJbJ8YHBwfm8sIkVEQBoFgiAIgiAIgiAIgiAIgiAIgiAIgoAD8Asu4+Zxzr0oijrXdf0EfAGvYFEUqfscx3HHcVwDVpOkg14QBOd5Ps/zcRy/JEn+BPwGHoF3cJ7n7Xa7D7Bt+0nwA7yCw+FwOHu9Xv8dx3Eb0DT9KnkE3sE0TXNZlmUZ9r2/DA0DxxjXNE2ndV0HwDHG1Wq1dq/X65Zl2Vwul7sl5UOahk3TnJzzPO+Px+O9Xq/vVqvVhmEYdlmWbZL6IU3DhmFc8jxn3vd9x+Px2m6367quu8fzvGu3270ALMsygA3D8DbLsvx4PB5Pr9d7AfgKroB7P5/PmxRF2Waz+W63+4YkSXZJ2oZwz/MuOI6zbdv2J7/f/8IwzAMcx5PkeT6bzebGcRz/ut/vH7lcrg7AW7Btm1VV1Y9arfaSJJlN0qZ8yU8Igq6q6pqm6c/z/GQymTuOY7/T6fRd13V3Jhk5B6Bpmk8mk+/3+z3XdT2bzX4N8QkDgD8BzWazv1qt9tfr9Z5KkoQ0DfsR+AYcx7nP87yPMeZ8pml6Op3+Pz4FDcNw3XU9m82+qqq+SNM0rFwul4/H47tM0zS9Xq+Lx+PXD4CPIAiCIAiCIAiCIAiCIAiCIAiCIAgC9AcH9WY3gtqr4QAAAABJRU5ErkJggg=='
);

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1120,
    minHeight: 720,
    title: '音效素材库',
    icon: path.join(__dirname, '..', 'build', process.platform === 'win32' ? 'icon.ico' : 'icon.png'),
    backgroundColor: '#111317',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 18, y: 18 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

async function walkFolder(rootDir) {
  const files = [];

  async function visit(currentDir) {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        await visit(fullPath);
        continue;
      }
      if (!entry.isFile()) continue;
      const extension = path.extname(entry.name).toLowerCase();
      if (!AUDIO_EXTENSIONS.has(extension)) continue;
      files.push(await audioFileInfo(fullPath, {
        folderRoot: rootDir,
        relativePath: path.relative(rootDir, fullPath),
        directory: path.relative(rootDir, path.dirname(fullPath)) || '根目录'
      }));
    }
  }

  await visit(rootDir);
  return files;
}

app.whenReady().then(async () => {
  nativeTheme.themeSource = 'system';
  nativeFileDrag = loadNativeFileDrag();
  appSettingsFile = path.join(app.getPath('userData'), 'app-settings.json');
  appSettings = await loadAppSettings();
  const legacyStorageDir = path.join(app.getPath('userData'), 'LocalLibrary');
  const defaultLibraryDir = path.join(app.getPath('userData'), 'soundeffect.library');
  storageDir = appSettings.libraryDir || await firstExistingPath([legacyStorageDir, defaultLibraryDir]) || defaultLibraryDir;
  configFile = path.join(storageDir, 'config.json');
  appConfig = await loadConfig();
  if (appConfig.waveCacheDir) waveCacheDir = appConfig.waveCacheDir;
  libraryFile = path.join(storageDir, 'library.json');
  waveCacheDir = waveCacheDir || path.join(storageDir, 'wave-cache');
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('library:chooseAudioFiles', async () => {
  const result = await dialog.showOpenDialog({
    title: '导入音效文件',
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: '音频文件', extensions: [...AUDIO_EXTENSIONS].map((item) => item.slice(1)) }]
  });
  if (result.canceled) return [];
  return Promise.all(result.filePaths.map((filePath) => audioFileInfo(filePath, {
    folderRoot: path.dirname(filePath),
    relativePath: path.basename(filePath),
    directory: '单独导入'
  })));
});

ipcMain.handle('library:chooseFolder', async () => {
  const result = await dialog.showOpenDialog({
    title: '导入音效文件夹',
    properties: ['openDirectory']
  });
  if (result.canceled || !result.filePaths[0]) return { root: null, files: [] };
  const root = result.filePaths[0];
  const files = await walkFolder(root);
  return { root, files };
});

ipcMain.handle('library:scanDroppedPaths', async (_event, droppedPaths) => {
  const allFiles = [];
  for (const itemPath of droppedPaths) {
    const stat = await fs.stat(itemPath);
    if (stat.isDirectory()) {
      allFiles.push(...await walkFolder(itemPath));
      continue;
    }
    const extension = path.extname(itemPath).toLowerCase();
    if (!AUDIO_EXTENSIONS.has(extension)) continue;
    allFiles.push(await audioFileInfo(itemPath, {
      folderRoot: path.dirname(itemPath),
      relativePath: path.basename(itemPath),
      directory: '拖入文件'
    }));
  }
  return allFiles;
});

async function audioFileInfo(filePath, overrides = {}) {
  const stat = await fs.stat(filePath);
  return {
    id: filePath,
    name: path.basename(filePath),
    path: filePath,
    folderRoot: overrides.folderRoot || path.dirname(filePath),
    relativePath: overrides.relativePath || path.basename(filePath),
    directory: overrides.directory || path.basename(path.dirname(filePath)),
    extension: path.extname(filePath).toLowerCase(),
    size: stat.size,
    modifiedAt: stat.mtimeMs,
    contentHash: await fileHash(filePath)
  };
}

async function fileHash(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fsSync.createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

ipcMain.handle('file:reveal', async (_event, filePath) => {
  const { shell } = require('electron');
  shell.showItemInFolder(filePath);
});

ipcMain.handle('file:exists', async (_event, filePath) => {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
});

ipcMain.handle('file:readAudio', async (_event, filePath) => {
  const buffer = await fs.readFile(filePath);
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
});

ipcMain.handle('file:hash', async (_event, filePath) => {
  return fileHash(filePath);
});

ipcMain.handle('file:url', async (_event, filePath) => {
  return pathToFileURL(filePath).href;
});

ipcMain.handle('app:platform', async () => {
  return process.platform;
});

ipcMain.handle('storage:loadLibrary', async () => {
  try {
    const json = await fs.readFile(libraryFile, 'utf8');
    return JSON.parse(json);
  } catch {
    return null;
  }
});

ipcMain.handle('storage:saveLibrary', (_event, data) => {
  const snapshot = JSON.stringify(data, null, 2);
  librarySaveChain = librarySaveChain
    .catch(() => {})
    .then(async () => {
      await fs.mkdir(storageDir, { recursive: true });
      await fs.writeFile(libraryFile, snapshot, 'utf8');
      return true;
    });
  return librarySaveChain;
});

ipcMain.handle('storage:loadWaveCache', async (_event, key) => {
  try {
    const json = await fs.readFile(path.join(waveCacheDir, `${safeCacheName(key)}.json`), 'utf8');
    return JSON.parse(json);
  } catch {
    return null;
  }
});

ipcMain.handle('storage:saveWaveCache', async (_event, key, data) => {
  await fs.mkdir(waveCacheDir, { recursive: true });
  await fs.writeFile(path.join(waveCacheDir, `${safeCacheName(key)}.json`), JSON.stringify(data), 'utf8');
  return true;
});

ipcMain.handle('storage:getCacheInfo', async () => {
  await fs.mkdir(waveCacheDir, { recursive: true });
  return {
    storageDir,
    libraryFile,
    waveCacheDir,
    waveCacheSize: await directorySize(waveCacheDir)
  };
});

ipcMain.handle('storage:chooseLibraryDir', async () => {
  const result = await dialog.showOpenDialog({
    title: '选择素材库保存位置',
    properties: ['openDirectory', 'createDirectory']
  });
  if (result.canceled || !result.filePaths[0]) return null;

  const selectedPath = result.filePaths[0];
  const nextStorageDir = path.basename(selectedPath).toLowerCase().endsWith('.library')
    ? selectedPath
    : path.join(selectedPath, 'soundeffect.library');
  const previousStorageDir = storageDir;

  await fs.mkdir(nextStorageDir, { recursive: true });
  if (previousStorageDir && previousStorageDir !== nextStorageDir) {
    await copyIfMissing(path.join(previousStorageDir, 'library.json'), path.join(nextStorageDir, 'library.json'));
    await copyIfMissing(path.join(previousStorageDir, 'config.json'), path.join(nextStorageDir, 'config.json'));
    await copyDirectoryIfMissing(path.join(previousStorageDir, 'wave-cache'), path.join(nextStorageDir, 'wave-cache'));
  }

  storageDir = nextStorageDir;
  configFile = path.join(storageDir, 'config.json');
  appConfig = await loadConfig();
  delete appConfig.waveCacheDir;
  libraryFile = path.join(storageDir, 'library.json');
  waveCacheDir = path.join(storageDir, 'wave-cache');
  await fs.mkdir(waveCacheDir, { recursive: true });
  appConfig.libraryDir = storageDir;
  await saveConfig();
  appSettings.libraryDir = storageDir;
  await saveAppSettings();
  return {
    storageDir,
    libraryFile,
    waveCacheDir,
    waveCacheSize: await directorySize(waveCacheDir)
  };
});

ipcMain.handle('storage:clearWaveCache', async () => {
  await fs.rm(waveCacheDir, { recursive: true, force: true });
  await fs.mkdir(waveCacheDir, { recursive: true });
  return true;
});

ipcMain.handle('storage:chooseWaveCacheDir', async () => {
  const result = await dialog.showOpenDialog({
    title: '选择波形缓存位置',
    properties: ['openDirectory', 'createDirectory']
  });
  if (result.canceled || !result.filePaths[0]) return null;
  waveCacheDir = path.join(result.filePaths[0], 'SoundLibraryManager-wave-cache');
  appConfig.waveCacheDir = waveCacheDir;
  await saveConfig();
  await fs.mkdir(waveCacheDir, { recursive: true });
  return waveCacheDir;
});

ipcMain.handle('resolve:importMedia', async (_event, filePath) => {
  return importIntoDaVinci(filePath);
});

ipcMain.on('file:startDrag', (event, filePath) => {
  primeFilePasteboard(filePath);
  if (startInProcessNativeFileDrag(filePath)) return;
  if (process.env.SOUND_LIBRARY_NATIVE_DRAG === '1' && startNativeFileDrag(filePath)) return;
  writeNativeDragLog(`fallback electron startDrag ${filePath}`);
  event.sender.startDrag({
    file: filePath,
    icon: DRAG_ICON
  });
});

function loadNativeFileDrag() {
  if (!['darwin', 'win32'].includes(process.platform)) return null;
  try {
    const modulePath = app.isPackaged
      ? path.join(process.resourcesPath, 'native', 'file-drag')
      : path.join(__dirname, '..', 'native', 'file-drag');
    const loaded = require(modulePath);
    if (loaded?.startFileDrag) {
      writeNativeDragLog(`loaded ${loaded.__nativeDragPath || modulePath}`);
      console.log('[native-drag] loaded');
    } else {
      writeNativeDragLog(`unavailable ${JSON.stringify(global.__nativeFileDragLoadErrors || [])}`);
    }
    return loaded;
  } catch (error) {
    writeNativeDragLog(`load failed ${error?.message || error}`);
    console.log('[native-drag] unavailable:', error?.message || error);
    return null;
  }
}

function startInProcessNativeFileDrag(filePath) {
  if (!nativeFileDrag?.startFileDrag) return false;
  try {
    const started = Boolean(nativeFileDrag.startFileDrag(filePath));
    writeNativeDragLog(`native start ${started} ${filePath}`);
    console.log('[native-drag] start:', started);
    return started;
  } catch (error) {
    writeNativeDragLog(`native failed ${error?.message || error}`);
    console.log('[native-drag] failed:', error?.message || error);
    return false;
  }
}

function writeNativeDragLog(message) {
  if (process.env.SOUND_LIBRARY_DEBUG_LOG !== '1') return;
  try {
    const sanitized = String(message)
      .replace(/[A-Za-z]:\\[^\r\n]*/g, '[path]')
      .replace(/\/Users\/[^\r\n]*/g, '[path]');
    const line = `[${new Date().toISOString()}] ${process.platform}/${process.arch} packaged=${app.isPackaged} ${sanitized}\n`;
    fsSync.appendFileSync(path.join(app.getPath('userData'), 'native-drag-runtime.log'), line, 'utf8');
  } catch {}
}

function startNativeFileDrag(filePath) {
  if (process.platform !== 'darwin') return false;
  const helperPath = nativeFileDragHelperPath();
  try {
    require('fs').accessSync(helperPath, require('fs').constants.X_OK);
  } catch {
    return false;
  }
  const child = spawn(helperPath, [filePath], {
    detached: true,
    stdio: 'ignore'
  });
  child.unref();
  return true;
}

function nativeFileDragHelperPath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'native', 'macos', 'bin', 'NativeFileDrag');
  }
  return path.join(__dirname, '..', 'native', 'macos', 'bin', 'NativeFileDrag');
}

function safeCacheName(value) {
  return Buffer.from(String(value)).toString('base64url');
}

async function loadConfig() {
  try {
    return JSON.parse(await fs.readFile(configFile, 'utf8'));
  } catch {
    return {};
  }
}

async function saveConfig() {
  await fs.mkdir(storageDir, { recursive: true });
  await fs.writeFile(configFile, JSON.stringify(appConfig, null, 2), 'utf8');
}

async function loadAppSettings() {
  try {
    return JSON.parse(await fs.readFile(appSettingsFile, 'utf8'));
  } catch {
    return {};
  }
}

async function saveAppSettings() {
  await fs.mkdir(path.dirname(appSettingsFile), { recursive: true });
  await fs.writeFile(appSettingsFile, JSON.stringify(appSettings, null, 2), 'utf8');
}

async function firstExistingPath(paths) {
  for (const itemPath of paths) {
    try {
      await fs.access(itemPath);
      return itemPath;
    } catch {}
  }
  return null;
}

async function copyIfMissing(source, target) {
  try {
    await fs.access(source);
  } catch {
    return;
  }
  try {
    await fs.access(target);
    return;
  } catch {}
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.copyFile(source, target);
}

async function copyDirectoryIfMissing(source, target) {
  try {
    await fs.access(source);
  } catch {
    return;
  }
  try {
    await fs.access(target);
    return;
  } catch {}
  await fs.cp(source, target, { recursive: true, force: false, errorOnExist: false });
}

async function directorySize(dirPath) {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    let total = 0;
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) total += await directorySize(fullPath);
      else if (entry.isFile()) total += (await fs.stat(fullPath)).size;
    }
    return total;
  } catch {
    return 0;
  }
}

async function importIntoDaVinci(filePath) {
  const scriptPath = path.join(app.getPath('temp'), 'sound-library-resolve-import.py');
  const modulePaths = resolveModulePaths();
  const resolveBinaryPaths = resolveExecutablePaths();
  const script = `
import os, sys
file_path = ${JSON.stringify(filePath)}
module_paths = ${JSON.stringify(modulePaths)}
resolve_binary_paths = ${JSON.stringify(resolveBinaryPaths)}
for binary_path in resolve_binary_paths:
  if binary_path and os.path.isdir(binary_path):
    os.environ["PATH"] = binary_path + os.pathsep + os.environ.get("PATH", "")
for module_path in module_paths:
  if module_path and os.path.isdir(module_path) and module_path not in sys.path:
    sys.path.append(module_path)
try:
  import DaVinciResolveScript as dvr
except Exception as exc:
  print("无法加载 DaVinci Resolve 脚本模块。请确认已安装 Resolve，并开启外部脚本。", file=sys.stderr)
  print("已尝试模块路径:", module_paths, file=sys.stderr)
  print("已尝试程序路径:", resolve_binary_paths, file=sys.stderr)
  print(str(exc), file=sys.stderr)
  sys.exit(2)
resolve = dvr.scriptapp("Resolve")
if not resolve:
  print("无法连接 DaVinci Resolve。请确认 Resolve 正在运行，并在偏好设置中允许本地脚本。", file=sys.stderr)
  sys.exit(3)
project = resolve.GetProjectManager().GetCurrentProject()
if not project:
  print("当前没有打开 DaVinci Resolve 项目。", file=sys.stderr)
  sys.exit(4)
media_pool = project.GetMediaPool()
if not media_pool.ImportMedia([file_path]):
  print("导入失败。Resolve 没有接收这个文件。请确认音频在 Windows 本地磁盘路径中，而不是 Z: 或 WebDAV 共享盘。", file=sys.stderr)
  print("文件路径:", file_path, file=sys.stderr)
  sys.exit(5)
print("OK")
`;
  await fs.writeFile(scriptPath, script, 'utf8');
  const python = await findPython();
  return new Promise((resolve) => {
    execFile(python.command, [...python.args, scriptPath], {
      timeout: 12000,
      env: {
        ...process.env,
        PYTHONPATH: modulePaths.filter(Boolean).join(path.delimiter)
      }
    }, (error, stdout, stderr) => {
      fs.unlink(scriptPath).catch(() => {});
      if (error) {
        resolve({ ok: false, message: stderr.trim() || error.message });
        return;
      }
      resolve({ ok: true, message: stdout.trim() || 'OK' });
    });
  });
}

function primeFilePasteboard(filePath) {
  if (process.platform !== 'darwin') return;
  const fileUrl = pathToFileURL(filePath).href;
  const filenamesPlist = `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><array><string>${escapePlistString(filePath)}</string></array></plist>`;
  clipboard.clear();
  clipboard.writeText(filePath);
  clipboard.writeBuffer('public.file-url', Buffer.from(fileUrl, 'utf8'));
  clipboard.writeBuffer('NSFilenamesPboardType', Buffer.from(filenamesPlist, 'utf8'));
  clipboard.writeBuffer('NSFileContentsPboardType', Buffer.from(filenamesPlist, 'utf8'));
}

function escapePlistString(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

async function findPython() {
  const candidates = process.platform === 'win32'
    ? [
        { command: 'py', args: ['-3'] },
        { command: 'python', args: [] },
        { command: 'python3', args: [] }
      ]
    : [
        { command: '/opt/homebrew/bin/python3', args: [] },
        { command: '/usr/local/bin/python3', args: [] },
        { command: '/usr/bin/python3', args: [] },
        { command: 'python3', args: [] }
      ];
  for (const candidate of candidates) {
    try {
      await new Promise((resolve, reject) => {
        execFile(candidate.command, [...candidate.args, '--version'], { timeout: 2000 }, (error) => error ? reject(error) : resolve());
      });
      return candidate;
    } catch {}
  }
  return { command: process.platform === 'win32' ? 'python' : 'python3', args: [] };
}

function resolveModulePaths() {
  if (process.platform === 'win32') {
    const programData = process.env.PROGRAMDATA || 'C:\\ProgramData';
    const appData = process.env.APPDATA || '';
    return [
      path.join(programData, 'Blackmagic Design', 'DaVinci Resolve', 'Support', 'Developer', 'Scripting', 'Modules'),
      path.join(programData, 'Blackmagic Design', 'DaVinci Resolve', 'Developer', 'Scripting', 'Modules'),
      appData ? path.join(appData, 'Blackmagic Design', 'DaVinci Resolve', 'Support', 'Developer', 'Scripting', 'Modules') : ''
    ].filter(Boolean);
  }
  return [
    '/Library/Application Support/Blackmagic Design/DaVinci Resolve/Developer/Scripting/Modules',
    '/Applications/DaVinci Resolve/DaVinci Resolve.app/Contents/Resources/Developer/Scripting/Modules',
    path.join(app.getPath('home'), 'Library', 'Application Support', 'Blackmagic Design', 'DaVinci Resolve', 'Developer', 'Scripting', 'Modules')
  ];
}

function resolveExecutablePaths() {
  if (process.platform === 'win32') {
    const programFiles = process.env.PROGRAMFILES || 'C:\\Program Files';
    const programFilesX86 = process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)';
    return [
      path.join(programFiles, 'Blackmagic Design', 'DaVinci Resolve'),
      path.join(programFilesX86, 'Blackmagic Design', 'DaVinci Resolve')
    ];
  }
  return [
    '/Applications/DaVinci Resolve/DaVinci Resolve.app/Contents/Libraries/Fusion',
    '/Applications/DaVinci Resolve/DaVinci Resolve.app/Contents/MacOS'
  ];
}
