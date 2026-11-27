// Cấu hình của Máy quầy: tài khoản chung nằm trong config.local.json cạnh dữ liệu (không bao giờ commit).
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { join } from 'node:path';
import { networkInterfaces } from 'node:os';
import type { TaiKhoan } from './dang-nhap.js';
import type { CauHinhSheet } from './kenh-apps-script.js';

/** Địa chỉ IPv4 trong mạng nội bộ, để điện thoại cùng Wi-Fi mở app. */
export function diaChiMangNoiBo(): string[] {
  return Object.values(networkInterfaces())
    .flatMap((ds) => ds ?? [])
    .filter((a) => a.family === 'IPv4' && !a.internal)
    .map((a) => a.address);
}

export interface CauHinh {
  taiKhoan: TaiKhoan;
  /** true khi vừa tạo tài khoản mới với mật khẩu ngẫu nhiên (cần báo cho chủ cửa hàng). */
  moiTao: boolean;
  duongDan: string;
  /** Web App Apps Script của Google Sheet để đồng bộ; chưa có thì chỉ lưu trên máy. */
  sheet?: CauHinhSheet;
}

/** Đọc cấu hình; lần đầu tạo tài khoản "cuahang" với mật khẩu ngẫu nhiên. */
export function docCauHinh(dataDir: string): CauHinh {
  const duongDan = join(dataDir, 'config.local.json');
  let moiTao = false;
  if (!existsSync(duongDan)) {
    const moi = { taiKhoan: { ten: 'cuahang', matKhau: randomBytes(6).toString('base64url') } };
    writeFileSync(duongDan, JSON.stringify(moi, null, 2) + '\n', 'utf8');
    moiTao = true;
  }
  const { taiKhoan, sheet } = JSON.parse(readFileSync(duongDan, 'utf8')) as { taiKhoan: TaiKhoan; sheet?: CauHinhSheet };
  return { taiKhoan, moiTao, duongDan, sheet: sheet?.url && sheet.khoa ? sheet : undefined };
}
