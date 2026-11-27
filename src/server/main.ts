// Điểm chạy của exe (chế độ dev): npm run dev
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { join } from 'node:path';
import { networkInterfaces } from 'node:os';
import { startServer } from './app.js';
import type { TaiKhoan } from './dang-nhap.js';

const port = Number(process.env.PORT ?? 8080);
const dataDir = process.env.DATA_DIR ?? join(process.cwd(), 'data');
mkdirSync(dataDir, { recursive: true });

// Tài khoản chung nằm trong config.local.json cạnh dữ liệu (không bao giờ commit).
// Lần đầu chạy: tạo tài khoản "cuahang" với mật khẩu ngẫu nhiên và in ra để chủ cửa hàng đổi.
const fileCauHinh = join(dataDir, 'config.local.json');
if (!existsSync(fileCauHinh)) {
  const moi = { taiKhoan: { ten: 'cuahang', matKhau: randomBytes(6).toString('base64url') } };
  writeFileSync(fileCauHinh, JSON.stringify(moi, null, 2) + '\n', 'utf8');
  console.log(`Đã tạo tài khoản mới trong ${fileCauHinh}`);
  console.log(`  Tên đăng nhập: ${moi.taiKhoan.ten}  Mật khẩu: ${moi.taiKhoan.matKhau}`);
}
const { taiKhoan } = JSON.parse(readFileSync(fileCauHinh, 'utf8')) as { taiKhoan: TaiKhoan };

const server = await startServer({ dbPath: join(dataDir, 'so-don-kinh.db'), port, taiKhoan });
console.log(`Sổ Đơn Kính đang chạy: http://localhost:${server.port}`);
// Địa chỉ để điện thoại cùng Wi-Fi mở app
for (const ds of Object.values(networkInterfaces())) {
  for (const a of ds ?? []) {
    if (a.family === 'IPv4' && !a.internal) console.log(`  Trên điện thoại cùng Wi-Fi: http://${a.address}:${server.port}`);
  }
}

const tat = () => server.close().then(() => process.exit(0));
process.on('SIGINT', tat);
process.on('SIGTERM', tat);
