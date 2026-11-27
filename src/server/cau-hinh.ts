// Cấu hình của Máy quầy: tài khoản chung nằm trong config.local.json cạnh dữ liệu (không bao giờ commit).
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { join } from 'node:path';
import { homedir, networkInterfaces } from 'node:os';
import { spawnSync } from 'node:child_process';

/**
 * Thư mục Desktop thật của người dùng Windows (kể cả khi Desktop được OneDrive chuyển đi),
 * để lưu Excel vào Desktop\Sổ Đơn Kính cho nhân viên dễ tìm.
 */
export function thuMucDesktop(): string {
  const r = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', "[Console]::OutputEncoding=[Text.Encoding]::UTF8; [Environment]::GetFolderPath('Desktop')"], {
    encoding: 'utf8', windowsHide: true, timeout: 10_000,
  });
  const p = (r.stdout ?? '').trim();
  return p && existsSync(p) ? p : join(homedir(), 'Desktop');
}
import type { TaiKhoan } from './dang-nhap.js';
import type { CauHinhSheet } from './kenh-apps-script.js';

type CardMang = Record<string, { address: string; family: string | number; internal: boolean }[] | undefined>;

// Card mạng ảo (máy ảo, WSL, Docker, VPN…) không dùng được từ điện thoại
const CARD_AO = /vethernet|virtualbox|vmware|hyper-v|wsl|docker|loopback|bluetooth|tailscale|zerotier|vpn/i;

const thuTu = (ip: string) => (ip.startsWith('192.168.') ? 0 : ip.startsWith('10.') ? 1 : /^172\.(1[6-9]|2\d|3[01])\./.test(ip) ? 2 : 3);

/** Lọc và xếp địa chỉ IPv4 mạng nội bộ: bỏ card ảo và địa chỉ tự cấp 169.254.*, Wi-Fi/LAN gia đình (192.168.*) lên đầu. */
export function locDiaChi(cards: CardMang): string[] {
  return Object.entries(cards)
    .filter(([ten]) => !CARD_AO.test(ten))
    .flatMap(([, ds]) => ds ?? [])
    .filter((a) => (a.family === 'IPv4' || a.family === 4) && !a.internal && !a.address.startsWith('169.254.'))
    .map((a) => a.address)
    .sort((a, b) => thuTu(a) - thuTu(b));
}

/** Địa chỉ IPv4 trong mạng nội bộ của máy này, để thiết bị khác cùng Wi-Fi mở app. */
export function diaChiMangNoiBo(): string[] {
  return locDiaChi(networkInterfaces());
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
