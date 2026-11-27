// Đóng gói SoDonKinh.exe bằng Node Single Executable Application (một file, không cần cài Node).
// Chạy: npm run build:exe   →   dist/exe/SoDonKinh.exe
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { build } from 'esbuild';

const OUT = join('dist', 'exe');
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

// npm, npx là .cmd trên Windows nên cần shell; node.exe thì không (đường dẫn có thể chứa dấu cách)
const chay = (cmd, args) => execFileSync(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32' && (cmd === 'npm' || cmd === 'npx') });

// 1. Giao diện
chay('npm', ['run', 'build:web']);

// 2. Máy chủ + điểm chạy exe gộp thành một file CommonJS (SEA chỉ chạy CommonJS)
await build({
  entryPoints: ['src/exe/main.ts'],
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  outfile: join(OUT, 'so-don-kinh.cjs'),
  // Ẩn cảnh báo "experimental" của Node; import.meta.url không có trong CommonJS
  banner: { js: 'process.removeAllListeners("warning"); const __import_meta_url = require("node:url").pathToFileURL(__filename).href;' },
  define: { 'import.meta.url': '__import_meta_url' },
  logLevel: 'warning',
});

// 3. Blob SEA, nhúng sẵn giao diện
writeFileSync(
  join(OUT, 'sea-config.json'),
  JSON.stringify({
    main: join(OUT, 'so-don-kinh.cjs'),
    output: join(OUT, 'sea-prep.blob'),
    disableExperimentalSEAWarning: true,
    assets: { 'index.html': join('dist', 'web', 'index.html'), 'app.js': join('dist', 'web', 'app.js') },
  }, null, 2),
);
chay(process.execPath, ['--experimental-sea-config', join(OUT, 'sea-config.json')]);

// 4. Chép node.exe rồi tiêm blob vào
const exe = join(OUT, 'SoDonKinh.exe');
copyFileSync(process.execPath, exe);
chay('npx', ['postject', exe, 'NODE_SEA_BLOB', join(OUT, 'sea-prep.blob'),
  '--sentinel-fuse', 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2', '--overwrite']);

console.log(`\nXong: ${exe}`);
