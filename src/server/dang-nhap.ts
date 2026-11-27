// Đăng nhập bằng tài khoản chung của cửa hàng; phiên lưu 30 ngày trong cookie.
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export interface TaiKhoan {
  ten: string;
  matKhau: string;
}

export const COOKIE = 'sdk_phien';
export const THOI_HAN_MS = 30 * 24 * 60 * 60 * 1000;

const bam = (s: string) => createHash('sha256').update(s, 'utf8').digest();

/** Tài khoản với mật khẩu đã băm: tài khoản lấy từ tab Cài đặt được lưu dạng này, không lưu chữ thật. */
export interface TaiKhoanBam {
  ten: string;
  matKhauBam: string;
}

export const bamMatKhau = (matKhau: string) => bam(matKhau).toString('hex');

export const thanhTaiKhoanBam = (tk: TaiKhoan): TaiKhoanBam => ({ ten: tk.ten, matKhauBam: tk.matKhau ? bamMatKhau(tk.matKhau) : '' });

/** So sánh không lộ thời gian, kể cả khi độ dài khác nhau. Tài khoản thiếu tên hoặc mật khẩu thì luôn từ chối. */
export function dungTaiKhoan(tk: TaiKhoan | TaiKhoanBam, ten: unknown, matKhau: unknown): boolean {
  const tkb = 'matKhauBam' in tk ? tk : thanhTaiKhoanBam(tk);
  if (!tkb.ten?.trim() || !/^[0-9a-f]{64}$/.test(tkb.matKhauBam)) return false;
  const a = timingSafeEqual(bam(String(ten ?? '').trim()), bam(tkb.ten.trim()));
  const b = timingSafeEqual(bam(String(matKhau ?? '')), Buffer.from(tkb.matKhauBam, 'hex'));
  return a && b;
}

export function taoMaPhien() {
  return randomBytes(32).toString('base64url');
}

/** Mã phiên chỉ lưu dạng băm trong CSDL. */
export function bamMaPhien(ma: string) {
  return bam(ma).toString('hex');
}

export function docMaPhien(cookieHeader: string | null | undefined): string | undefined {
  const c = cookieHeader ?? '';
  for (const phan of c.split(';')) {
    const [k, ...v] = phan.trim().split('=');
    if (k === COOKIE) return v.join('=');
  }
  return undefined;
}

export function cookiePhien(ma: string, maxAgeGiay: number, https = false) {
  return `${COOKIE}=${ma}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAgeGiay}${https ? '; Secure' : ''}`;
}
