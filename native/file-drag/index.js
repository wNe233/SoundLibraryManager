const path = require('path');

function loadNative() {
  const supported = new Set(['darwin', 'win32']);
  if (!supported.has(process.platform)) return null;
  const arches = [`${process.platform}-${process.arch}`];
  if (process.platform === 'win32' && !arches.includes('win32-x64')) {
    arches.push('win32-x64');
  }
  const resourceNativeDir = process.resourcesPath
    ? path.join(process.resourcesPath, 'native', 'file-drag')
    : null;
  const candidates = [
    ...arches.flatMap((arch) => [
      resourceNativeDir && path.join(resourceNativeDir, 'prebuilds', arch, 'native_file_drag.node'),
      path.join(__dirname, 'prebuilds', arch, 'native_file_drag.node')
    ]),
    path.join(__dirname, 'build', 'Release', 'native_file_drag.node')
  ].filter(Boolean);
  const errors = [];
  for (const candidate of candidates) {
    try {
      const loaded = require(candidate);
      loaded.__nativeDragPath = candidate;
      return loaded;
    } catch (error) {
      errors.push(`${candidate}: ${error?.message || error}`);
    }
  }
  global.__nativeFileDragLoadErrors = errors;
  return null;
}

module.exports = loadNative();
