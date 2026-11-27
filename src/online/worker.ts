// Bản online trên Cloudflare Workers (ADR 0006): giao diện là static assets, /api/* dùng chung src/server/api.ts
// với exe, dữ liệu trong D1. Đồng bộ với Google Sheet như một Máy quầy: đẩy ngầm sau mỗi lần lưu, kéo mỗi phút.
import { DongBo } from '../server/dong-bo.js';
import { KenhAppsScript } from '../server/kenh-apps-script.js';
import { homNayVietNam, xuLyApi } from '../server/api.js';
import { KhoD1, type D1 } from './kho-d1.js';

export interface Env {
  DB: D1;
  ASSETS: { fetch(req: Request): Promise<Response> };
  /** Secret: tài khoản chung của cửa hàng. */
  TEN_DANG_NHAP: string;
  MAT_KHAU: string;
  /** Secret: Web App Apps Script và Khóa Máy quầy (tab Cài đặt của Sheet). Không có thì không đồng bộ. */
  SHEET_URL?: string;
  SHEET_KHOA?: string;
}

interface NguCanh {
  waitUntil(p: Promise<unknown>): void;
}

/** Kéo từ Sheet khi có yêu cầu mà lần đồng bộ trước đã quá lâu (ngoài lịch mỗi phút). */
const KEO_SAU_MS = 20_000;

const daKhoiTao = new WeakMap<object, Promise<void>>();

function chuanBi(env: Env) {
  const kho = new KhoD1(env.DB);
  // Tạo bảng một lần cho mỗi phiên bản Worker đang chạy
  let san = daKhoiTao.get(env.DB);
  if (!san) {
    san = kho.khoiTao().catch((e) => {
      daKhoiTao.delete(env.DB);
      throw e;
    });
    daKhoiTao.set(env.DB, san);
  }
  const dongBo = env.SHEET_URL && env.SHEET_KHOA
    ? new DongBo(kho, new KenhAppsScript({ url: env.SHEET_URL, khoa: env.SHEET_KHOA }), Date.now, (s) => console.log(s), {
      ten: env.TEN_DANG_NHAP, matKhau: env.MAT_KHAU,
    })
    : undefined;
  return { kho, dongBo, san };
}

export default {
  async fetch(req: Request, env: Env, ctx: NguCanh): Promise<Response> {
    const url = new URL(req.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(req);

    const { kho, dongBo, san } = chuanBi(env);
    await san;
    const res = await xuLyApi(req, {
      kho,
      taiKhoan: { ten: env.TEN_DANG_NHAP, matKhau: env.MAT_KHAU },
      today: () => homNayVietNam(),
      bayGio: Date.now,
      coSheet: !!dongBo,
      https: url.protocol === 'https:',
      links: (u) => [u.origin],
    });

    if (dongBo) {
      // Sau khi đã trả lời người dùng: có thay đổi thì đẩy ngay; lâu chưa đồng bộ thì kéo về
      const lanCuoi = Number(await kho.trangThai('lanThu')) || 0;
      if (req.method !== 'GET' || Date.now() - lanCuoi > KEO_SAU_MS) {
        ctx.waitUntil(kho.datTrangThai('lanThu', String(Date.now())).then(() => dongBo.chayMotLan()));
      }
    }
    return res;
  },

  /** Cron mỗi phút: kéo thay đổi từ Sheet (Máy quầy, người sửa tay) và đẩy ô còn chờ. */
  async scheduled(_e: unknown, env: Env, ctx: NguCanh) {
    const { dongBo, san } = chuanBi(env);
    if (dongBo) ctx.waitUntil(san.then(() => dongBo.chayMotLan()));
  },
};
