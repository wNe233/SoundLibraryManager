const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const PELibrary = require('pe-library');
const ResEdit = require('resedit');

const root = path.join(__dirname, '..');
const pkg = require(path.join(root, 'package.json'));
const electronVersion = require(path.join(root, 'node_modules', 'electron', 'package.json')).version;
const cacheRoot = path.join(os.homedir(), 'Library', 'Caches', 'electron');
const staging = path.join(root, 'build', 'win-ready-staging');
const appStaging = path.join(root, 'build', 'win-ready-app');
const dist = path.join(root, 'dist');
const target = path.join(dist, `SoundLibraryManager-${pkg.version}-win-x64-ready.zip`);

function copyDir(source, destination, filter = () => true) {
  fs.mkdirSync(destination, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    if (!filter(entry)) continue;
    const sourcePath = path.join(source, entry.name);
    const destinationPath = path.join(destination, entry.name);
    if (entry.isDirectory()) copyDir(sourcePath, destinationPath, filter);
    else if (entry.isFile()) fs.copyFileSync(sourcePath, destinationPath);
  }
}

function findElectronZip() {
  if (!fs.existsSync(cacheRoot)) return null;
  const expected = `electron-v${electronVersion}-win32-x64.zip`;
  for (const directory of fs.readdirSync(cacheRoot)) {
    const candidate = path.join(cacheRoot, directory, expected);
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function updateExecutable(executablePath) {
  const executable = PELibrary.NtExecutable.from(fs.readFileSync(executablePath), { ignoreCert: true });
  const resources = PELibrary.NtExecutableResource.from(executable);
  const versions = ResEdit.Resource.VersionInfo.fromEntries(resources.entries);
  for (const version of versions) {
    const languages = version.getAllLanguagesForStringValues();
    const targets = languages.length ? languages : [{ lang: 1033, codepage: 1200 }];
    version.setFileVersion(1, 0, 0, 0);
    version.setProductVersion(1, 0, 0, 0);
    for (const language of targets) {
      version.setStringValues(language, {
        CompanyName: 'Yuanquan & OpenAI Codex',
        FileDescription: '本地音效素材库管理器',
        FileVersion: pkg.version,
        InternalName: 'SoundLibraryManager',
        LegalCopyright: 'Copyright (c) 2026 Yuanquan and OpenAI Codex',
        OriginalFilename: 'SoundLibraryManager.exe',
        ProductName: 'SoundLibraryManager',
        ProductVersion: pkg.version
      });
    }
    version.outputToResourceEntries(resources.entries);
  }

  const icon = ResEdit.Data.IconFile.from(fs.readFileSync(path.join(root, 'build', 'icon.ico')));
  const groups = ResEdit.Resource.IconGroupEntry.fromEntries(resources.entries);
  const groupId = groups[0]?.id || 1;
  const groupLang = groups[0]?.lang || 1033;
  ResEdit.Resource.IconGroupEntry.replaceIconsForResource(
    resources.entries,
    groupId,
    groupLang,
    icon.icons.map((item) => item.data)
  );

  resources.outputResource(executable);
  fs.writeFileSync(executablePath, Buffer.from(executable.generate()));
}

const electronZip = findElectronZip();
if (!electronZip) {
  throw new Error(`没有找到 Electron ${electronVersion} Windows x64 缓存。请先运行 npm run build:win 下载一次。`);
}

fs.rmSync(staging, { recursive: true, force: true });
fs.rmSync(appStaging, { recursive: true, force: true });
fs.mkdirSync(staging, { recursive: true });
fs.mkdirSync(appStaging, { recursive: true });
fs.mkdirSync(dist, { recursive: true });
execFileSync('unzip', ['-q', electronZip, '-d', staging]);

const electronExe = path.join(staging, 'electron.exe');
const productExe = path.join(staging, 'SoundLibraryManager.exe');
fs.renameSync(electronExe, productExe);
fs.rmSync(path.join(staging, 'resources', 'default_app.asar'), { force: true });

const localesDir = path.join(staging, 'locales');
for (const fileName of fs.readdirSync(localesDir)) {
  if (!['zh-CN.pak', 'en-US.pak'].includes(fileName)) {
    fs.rmSync(path.join(localesDir, fileName), { force: true });
  }
}

copyDir(path.join(root, 'src'), path.join(appStaging, 'src'));
copyDir(path.join(root, 'build'), path.join(appStaging, 'build'), (entry) => /^icon\.(png|ico|icns)$/.test(entry.name));
fs.copyFileSync(path.join(root, 'package.json'), path.join(appStaging, 'package.json'));

const asarCli = path.join(root, 'node_modules', '@electron', 'asar', 'bin', 'asar.js');
execFileSync(process.execPath, [asarCli, 'pack', appStaging, path.join(staging, 'resources', 'app.asar')]);

const nativeTarget = path.join(staging, 'resources', 'native', 'file-drag');
fs.mkdirSync(nativeTarget, { recursive: true });
fs.copyFileSync(path.join(root, 'native', 'file-drag', 'index.js'), path.join(nativeTarget, 'index.js'));
copyDir(path.join(root, 'native', 'file-drag', 'prebuilds'), path.join(nativeTarget, 'prebuilds'));

updateExecutable(productExe);
fs.rmSync(target, { force: true });
execFileSync('zip', ['-qry', target, '.'], { cwd: staging });
console.log(target);
