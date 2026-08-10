const fs = require('fs');
const path = require('path');

function sanitizeCodeViewPaths(filePath) {
  const buffer = fs.readFileSync(filePath);
  const signature = Buffer.from('RSDS');
  let offset = 0;
  let sanitized = 0;

  while ((offset = buffer.indexOf(signature, offset)) !== -1) {
    const pathStart = offset + 24;
    const pathEnd = buffer.indexOf(0, pathStart);
    if (pathEnd === -1) break;

    const embeddedPath = buffer.toString('utf8', pathStart, pathEnd);
    if (/^(?:[A-Za-z]:\\|\/)/.test(embeddedPath)) {
      const replacement = Buffer.from(path.win32.basename(embeddedPath.replaceAll('/', '\\')) || path.basename(embeddedPath));
      buffer.fill(0, pathStart, pathEnd + 1);
      replacement.copy(buffer, pathStart, 0, Math.min(replacement.length, pathEnd - pathStart));
      sanitized += 1;
    }
    offset = pathEnd + 1;
  }

  if (sanitized) fs.writeFileSync(filePath, buffer);
  return sanitized;
}

const targets = process.argv.slice(2);
if (!targets.length) {
  console.error('Usage: node scripts/sanitize-native-binary.js <native binary>');
  process.exit(1);
}

for (const target of targets) {
  if (!fs.existsSync(target)) throw new Error(`Native binary not found: ${target}`);
  const count = sanitizeCodeViewPaths(target);
  console.log(`${target}: sanitized ${count} local debug path(s)`);
}
