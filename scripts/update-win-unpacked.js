const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.join(__dirname, '..');
const staging = path.join(root, 'build', 'win-app-staging');
const resourcesCandidates = [
  path.join(root, 'dist', 'win-unpacked', 'resources'),
  path.join(root, 'win-unpacked', 'resources')
];
const resourcesDir = resourcesCandidates.find((candidate) => fs.existsSync(candidate));

function rmDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

function copyDir(source, target) {
  if (!fs.existsSync(source)) {
    throw new Error(`Missing required directory: ${source}`);
  }
  fs.mkdirSync(target, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const sourcePath = path.join(source, entry.name);
    const targetPath = path.join(target, entry.name);
    if (entry.isDirectory()) copyDir(sourcePath, targetPath);
    else if (entry.isFile()) fs.copyFileSync(sourcePath, targetPath);
  }
}

if (!resourcesDir) {
  throw new Error(`Missing Windows resources directory. Checked: ${resourcesCandidates.join(', ')}`);
}

const asarPath = path.join(resourcesDir, 'app.asar');

rmDir(staging);
fs.mkdirSync(staging, { recursive: true });
copyDir(path.join(root, 'src'), path.join(staging, 'src'));
fs.copyFileSync(path.join(root, 'package.json'), path.join(staging, 'package.json'));
copyDir(path.join(root, 'native', 'file-drag'), path.join(staging, 'native', 'file-drag'));
rmDir(path.join(staging, 'native', 'file-drag', 'build'));
fs.mkdirSync(path.join(staging, 'build'), { recursive: true });
for (const fileName of ['icon.png', 'icon.ico', 'icon.icns']) {
  fs.copyFileSync(path.join(root, 'build', fileName), path.join(staging, 'build', fileName));
}

const resourceNativeDir = path.join(resourcesDir, 'native', 'file-drag');
rmDir(resourceNativeDir);
copyDir(path.join(root, 'native', 'file-drag'), resourceNativeDir);
rmDir(path.join(resourceNativeDir, 'build'));

const asarCli = path.join(root, 'node_modules', '@electron', 'asar', 'bin', 'asar.js');
if (!fs.existsSync(asarCli)) {
  throw new Error('Missing asar packer. Please run npm install first, then run this script again.');
}

execFileSync(process.execPath, [asarCli, 'pack', staging, asarPath], {
  cwd: root,
  stdio: 'inherit'
});

console.log(`Updated ${asarPath}`);
