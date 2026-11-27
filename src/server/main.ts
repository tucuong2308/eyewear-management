// Điểm chạy chế độ dev: npm run dev
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { startServer } from './app.js';
import { diaChiMangNoiBo, docCauHinh } from './cau-hinh.js';

const port = Number(process.env.PORT ?? 8080);
const dataDir = process.env.DATA_DIR ?? join(process.cwd(), 'data');
mkdirSync(dataDir, { recursive: true });

const ch = docCauHinh(dataDir);
if (ch.moiTao) {
  console.log(`Đã tạo tài khoản mới trong ${ch.duongDan}`);
  console.log(`  Tên đăng nhập: ${ch.taiKhoan.ten}  Mật khẩu: ${ch.taiKhoan.matKhau}`);
}

const server = await startServer({
  // chế độ dev: file Excel nằm trong thư mục dữ liệu, không làm rối Desktop của máy dev
  fileDuLieu: join(dataDir, 'So-don-kinh.xlsx'),
  thuMucSaoLuu: join(dataDir, 'Sao lưu'),
  port,
  taiKhoan: ch.taiKhoan,
  ghiLog: (s) => console.log(s),
});
console.log(`Sổ Đơn Kính đang chạy: http://localhost:${server.port}`);
for (const a of diaChiMangNoiBo()) console.log(`  Trên điện thoại cùng Wi-Fi: http://${a}:${server.port}`);

const tat = () => server.close().then(() => process.exit(0));
process.on('SIGINT', tat);
process.on('SIGTERM', tat);
