// Đóng gói code Apps Script: npm run build:apps-script → apps-script/dist/ (Code.js + appsscript.json)
// Đưa lên Google: cd apps-script && npx @google/clasp push   (xem docs/apps-script.md)
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { build } from 'esbuild';

// Nằm trong apps-script/ vì clasp 3 từ chối rootDir ở ngoài thư mục dự án clasp
const OUT = join('apps-script', 'dist');
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
// caiDat đứng đầu: ô chọn hàm của trình soạn Apps Script mặc định chọn hàm đầu tiên
const HAM = ['caiDat', 'doPost', 'doGet', 'onEdit', 'saoLuuHangDem'];
const boc = HAM.map((h) => `function ${h}(e) { return __SDK.${h}(e); }`).join('\n');
writeFileSync(join(OUT, 'Code.js'), `// Tạo bởi scripts/build-apps-script.mjs, đừng sửa tay.\n${kq.outputFiles[0].text}\n${boc}\n`);
copyFileSync(join('apps-script', 'appsscript.json'), join(OUT, 'appsscript.json'));
console.log(`Xong: ${OUT}`);
