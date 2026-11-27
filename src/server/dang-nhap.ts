// Đăng nhập bằng tài khoản chung của cửa hàng; phiên lưu 30 ngày trong cookie.
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export interface TaiKhoan {
  ten: string;
  matKhau: string;
}

export const COOKIE = 'sdk_phien';
export const THOI_HAN_MS = 30 * 24 * 60 * 60 * 1000;

const bam = (s: string) => createHash('sha256').update(s, 'utf8').digest();

/** So sánh không lộ thời gian, kể cả khi độ dài khác nhau. */
export function dungTaiKhoan(tk: TaiKhoan, ten: unknown, matKhau: unknown): boolean {
  const a = timingSafeEqual(bam(String(ten ?? '').trim()), bam(tk.ten));
  const b = timingSafeEqual(bam(String(matKhau ?? '')), bam(tk.matKhau));
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
