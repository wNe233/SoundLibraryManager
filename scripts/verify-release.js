const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const pkg = require(path.join(root, 'package.json'));
const requiredFiles = [
  'src/main.js',
  'src/preload.js',
  'src/renderer/index.html',
  'src/renderer/app.js',
  'src/renderer/styles.css',
  'build/icon.png',
  'build/icon.icns',
  'build/icon.ico',
  'native/file-drag/index.js',
  'native/file-drag/prebuilds/darwin-arm64/native_file_drag.node',
  'native/file-drag/prebuilds/win32-x64/native_file_drag.node'
];

const missing = requiredFiles.filter((relativePath) => !fs.existsSync(path.join(root, relativePath)));
if (pkg.version !== '1.0.0') {
  throw new Error(`发布版本应为 1.0.0，当前为 ${pkg.version}`);
}
if (missing.length) {
  throw new Error(`缺少发布文件：${missing.join(', ')}`);
}

const mainSource = fs.readFileSync(path.join(root, 'src/main.js'), 'utf8');
const rendererSource = fs.readFileSync(path.join(root, 'src/renderer/app.js'), 'utf8');
if (!mainSource.includes("['darwin', 'win32'].includes(process.platform)")) {
  throw new Error('主进程没有同时启用 macOS 和 Windows 原生拖拽');
}
if (!mainSource.includes("path.join(process.resourcesPath, 'native', 'file-drag')")) {
  throw new Error('发布包没有从 Resources 目录加载原生拖拽模块');
}
if (!rendererSource.includes('renderLimit') || !rendererSource.includes('folderChildrenByParent')) {
  throw new Error('大素材库性能优化未包含在发布源码中');
}
if (!rendererSource.includes('state.audio && target && state.audio.dataset.id === target.id')) {
  throw new Error('空素材库播放控件保护未包含在发布源码中');
}

console.log('Release verification passed: 1.0.0, macOS arm64, Windows x64.');
