// Điểm chạy chế độ dev: npm run dev
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { startServer } from './app.js';
import { diaChiMangNoiBo, docCauHinh } from './cau-hinh.js';

const port = Number(process.env.PORT ?? 8080);
const dataDir = process.env.DATA_DIR ?? join(process.cwd(), 'data');
mkdirSync(dataDir, { recursive: true });

const ch = docCauHinh(dataDir);
console.log(ch.taiKhoan ? `Đăng nhập: bật (tài khoản trong ${ch.duongDan})` : 'Đăng nhập: tắt (chạy local)');

const server = await startServer({ dbPath: join(dataDir, 'so-don-kinh.db'), port, taiKhoan: ch.taiKhoan });
console.log(`Sổ Đơn Kính đang chạy: http://localhost:${server.port}`);
for (const a of diaChiMangNoiBo()) console.log(`  Trên điện thoại cùng Wi-Fi: http://${a}:${server.port}`);

const tat = () => server.close().then(() => process.exit(0));
process.on('SIGINT', tat);
process.on('SIGTERM', tat);
