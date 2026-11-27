// Đóng gói code Apps Script: npm run build:apps-script → dist/apps-script/ (Code.js + appsscript.json)
// Đưa lên Google: cd apps-script && npx @google/clasp push   (xem docs/apps-script.md)
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { build } from 'esbuild';

const OUT = join('dist', 'apps-script');
mkdirSync(OUT, { recursive: true });

const kq = await build({
  entryPoints: ['src/apps-script/gas.ts'],
  bundle: true,
  format: 'iife',
  globalName: '__SDK',
  target: 'es2019',
  write: false,
  logLevel: 'warning',
});

// Apps Script chỉ gọi được hàm khai báo ở cấp cao nhất
const HAM = ['doPost', 'doGet', 'onEdit', 'caiDat', 'saoLuuHangDem'];
const boc = HAM.map((h) => `function ${h}(e) { return __SDK.${h}(e); }`).join('\n');
writeFileSync(join(OUT, 'Code.js'), `// Tạo bởi scripts/build-apps-script.mjs, đừng sửa tay.\n${kq.outputFiles[0].text}\n${boc}\n`);
copyFileSync(join('apps-script', 'appsscript.json'), join(OUT, 'appsscript.json'));
console.log(`Xong: ${OUT}`);
