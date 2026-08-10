const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.join(__dirname, '..');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const dist = path.join(root, 'dist');
const staging = path.join(root, 'build', 'win-native-package');
const target = path.join(dist, `SoundLibraryManager-${packageJson.version}-win-x64-native-drag-package.zip`);

function copyDir(source, targetDir, options = {}) {
  fs.mkdirSync(targetDir, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    if (options.exclude?.some((pattern) => pattern.test(entry.name))) continue;
    const sourcePath = path.join(source, entry.name);
    const targetPath = path.join(targetDir, entry.name);
    if (entry.isDirectory()) copyDir(sourcePath, targetPath, options);
    else if (entry.isFile()) fs.copyFileSync(sourcePath, targetPath);
  }
}

fs.rmSync(staging, { recursive: true, force: true });
fs.mkdirSync(staging, { recursive: true });
copyDir(path.join(root, 'dist', 'win-unpacked'), path.join(staging, 'win-unpacked'));
copyDir(path.join(root, 'src'), path.join(staging, 'src'));
copyDir(path.join(root, 'native', 'file-drag'), path.join(staging, 'native', 'file-drag'), {
  exclude: [/^build$/, /^.*\.pdb$/, /^.*\.lib$/, /^.*\.exp$/]
});
copyDir(path.join(root, 'build'), path.join(staging, 'build'), {
  exclude: [/^win-app-staging$/, /^win-native-package$/, /^tmp$/]
});
fs.mkdirSync(path.join(staging, 'scripts'), { recursive: true });
for (const script of ['build-native-file-drag-win.ps1', 'sanitize-native-binary.js', 'update-win-unpacked.js']) {
  fs.copyFileSync(path.join(root, 'scripts', script), path.join(staging, 'scripts', script));
}
fs.copyFileSync(path.join(root, 'scripts', 'build-native-file-drag-win.cmd'), path.join(staging, 'scripts', 'build-native-file-drag-win.cmd'));
fs.copyFileSync(path.join(root, 'package.json'), path.join(staging, 'package.json'));
fs.copyFileSync(path.join(root, 'package-lock.json'), path.join(staging, 'package-lock.json'));
fs.rmSync(target, { force: true });
execFileSync('zip', ['-qry', target, '.'], {
  cwd: staging,
  stdio: 'inherit'
});
console.log(target);
