// Máy chủ web của exe: phục vụ giao diện và chuyển /api/* cho src/server/api.ts (kho file Excel).
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { KhoExcel } from './kho-excel.js';
import { xuLyApi, type LoiCoMaHttp, type MoiTruongApi } from './api.js';
import { diaChiMangNoiBo } from './cau-hinh.js';
import { DongBo } from './dong-bo.js';
import type { KenhSheet } from '../core/dong-bo.js';
import type { TaiKhoan } from './dang-nhap.js';

export interface ServerOptions {
  /** File Excel là dữ liệu chính (ADR 0004); Máy quầy: Desktop\Sổ Đơn Kính\So-don-kinh.xlsx. */
  fileDuLieu: string;
  /** Thư mục giữ bản sao hằng ngày (Máy quầy: Sổ Đơn Kính\Sao lưu); không có thì không sao lưu. */
  thuMucSaoLuu?: string;
  /** Chu kỳ kiểm tra sao lưu (ms); 0 = không tự chạy. Mặc định 1 giờ (mỗi ngày một bản, ghi đè trong ngày). */
  chuKySaoLuu?: number;
  /** Đổi tên file tạm thành file chính; test tiêm vào để giả lập file đang mở trong Excel. */
  doiTenFile?: (tu: string, den: string) => void;
  port: number;
  host?: string;
  /** Ngày hôm nay dạng YYYY-MM-DD theo giờ máy; tiêm vào để test. */
  today?: () => string;
  /** Thư mục chứa giao diện đã build (index.html, app.js). */
  webDir?: string;
  /** Đọc một tệp giao diện theo tên; exe dùng để lấy tệp nhúng sẵn thay cho webDir. */
  docTepGiaoDien?: (ten: string) => Promise<Buffer>;
  /** Tài khoản chung của cửa hàng. */
  taiKhoan: TaiKhoan;
  /** Thời điểm hiện tại (ms); tiêm vào để test hạn phiên. */
  bayGio?: () => number;
  /** Google Sheet để đồng bộ (ADR 0003); không có thì chỉ lưu trên máy. */
  kenhSheet?: KenhSheet;
  /** Chu kỳ tự đồng bộ (ms); 0 = không tự chạy (test gọi dongBo()). Mặc định 30 giây. */
  chuKyDongBo?: number;
  ghiLog?: (s: string) => void;
  /** Địa chỉ mạng nội bộ của máy; tiêm vào để test. */
  diaChiMang?: () => string[];
}

export interface RunningServer {
  port: number;
  /** Chạy một lượt đồng bộ ngay (không làm gì nếu không có Sheet). */
  dongBo(): Promise<void>;
  close(): Promise<void>;
}

export function homNayTheoMay(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export async function startServer(opts: ServerOptions): Promise<RunningServer> {
  const kho = await KhoExcel.mo(opts.fileDuLieu, { doiTen: opts.doiTenFile });
  const today = opts.today ?? homNayTheoMay;
  const webDir = opts.webDir ?? join(ROOT, 'dist', 'web');
  const bayGio = opts.bayGio ?? Date.now;
  const dongBo = opts.kenhSheet ? new DongBo(kho, opts.kenhSheet, bayGio, opts.ghiLog) : undefined;
  const moiTruong: MoiTruongApi = {
    kho, taiKhoan: opts.taiKhoan, today, bayGio, coSheet: !!dongBo,
    // Link để mở app trên thiết bị khác cùng mạng (điện thoại, máy khác)
    links: () => (opts.diaChiMang ?? diaChiMangNoiBo)().map((ip) => `http://${ip}:${port}`),
  };

  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', 'http://localhost');
      if (url.pathname.startsWith('/api/')) {
        // Nhân viên có thể vừa sửa file Excel rồi Lưu: đọc lại trước khi trả lời
        await kho.docLaiNeuDoi();
        return await guiResponse(res, await xuLyApi(await thanhRequest(req, url), moiTruong));
      }
      return await phucVuGiaoDien(res, url.pathname);
    } catch (e) {
      const ma = (e as Partial<LoiCoMaHttp>).maHttp;
      guiJson(res, ma ?? 500, ma ? { loi: (e as Error).message } : { loi: 'Lỗi máy chủ', chiTiet: String(e) });
    }
  });

  async function phucVuGiaoDien(res: ServerResponse, path: string) {
    const files: Record<string, [string, string]> = {
      '/': ['index.html', 'text/html; charset=utf-8'],
      '/app.js': ['app.js', 'text/javascript; charset=utf-8'],
      '/app.js.map': ['app.js.map', 'application/json'],
    };
    const f = files[path];
    if (!f) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      return res.end('Không tìm thấy');
    }
    try {
      const data = opts.docTepGiaoDien ? await opts.docTepGiaoDien(f[0]) : await readFile(join(webDir, f[0]));
      res.writeHead(200, { 'content-type': f[1], 'cache-control': 'no-store' });
      res.end(data);
    } catch {
      res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('Chưa build giao diện. Chạy: npm run build:web');
    }
  }

  await new Promise<void>((resolve) => server.listen(opts.port, opts.host ?? '0.0.0.0', resolve));
  const addr = server.address();
  const port = typeof addr === 'object' && addr ? addr.port : opts.port;

  // Bản sao hằng ngày của file Excel (ghi đè trong ngày, giữ 30 bản)
  let henSaoLuu: ReturnType<typeof setInterval> | undefined;
  const chuKySaoLuu = opts.chuKySaoLuu ?? 60 * 60_000;
  if (opts.thuMucSaoLuu && chuKySaoLuu > 0) {
    const thuMuc = opts.thuMucSaoLuu;
    const saoLuu = () => kho.saoLuu(thuMuc, today()).then(
      (f) => opts.ghiLog?.(`Đã sao lưu: ${f}`),
      (e) => opts.ghiLog?.(`Sao lưu lỗi: ${(e as Error).message}`),
    );
    void saoLuu();
    henSaoLuu = setInterval(saoLuu, chuKySaoLuu);
    henSaoLuu.unref?.();
  }

  const chuKy = opts.chuKyDongBo ?? 30_000;
  if (dongBo && chuKy > 0) dongBo.batDau(chuKy);

  return {
    port,
    dongBo: async () => {
      await dongBo?.chayMotLan();
    },
    close: () =>
      new Promise<void>((resolve, reject) => {
        dongBo?.dung();
        if (henSaoLuu) clearInterval(henSaoLuu);
        server.closeAllConnections();
        server.close((err) => {
          void kho.dong().then(() => (err ? reject(err) : resolve()));
        });
      }),
  };
}

function guiJson(res: ServerResponse, status: number, data: unknown) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

/** Yêu cầu của Node → Request chuẩn web cho api.ts. */
async function thanhRequest(req: IncomingMessage, url: URL): Promise<Request> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v);
  const body = chunks.length && req.method !== 'GET' && req.method !== 'HEAD' ? Buffer.concat(chunks) : undefined;
  return new Request(url, { method: req.method, headers, body });
}

async function guiResponse(res: ServerResponse, r: Response) {
  res.writeHead(r.status, Object.fromEntries(r.headers));
  res.end(Buffer.from(await r.arrayBuffer()));
}
