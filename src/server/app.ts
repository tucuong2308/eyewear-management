// Máy chủ web của exe: API Đơn kính + phục vụ giao diện.
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  DANH_SACH_THEM_DUOC, DA_TRA, chuanHoa, demTheoNgay, denHen, kinhHen, laThang, suCo, timDon, laLoaiDanhSach, laTruongSuaDuoc, themVaoDanhSach,
} from '../core/don-kinh.js';
import { KhoDonKinh } from './kho.js';
import { xuatExcel } from './xuat-excel.js';
import { diaChiMangNoiBo } from './cau-hinh.js';
import { DongBo } from './dong-bo.js';
import type { KenhSheet } from '../core/dong-bo.js';
import {
  THOI_HAN_MS, bamMaPhien, cookiePhien, docMaPhien, dungTaiKhoan, taoMaPhien, type TaiKhoan,
} from './dang-nhap.js';

export interface ServerOptions {
  dbPath: string;
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
  /** Thư mục lưu file Excel (Máy quầy: Desktop\Sổ Đơn Kính); không có thì không xuất Excel. */
  thuMucExcel?: string;
  /** Chu kỳ tự lưu Excel (ms); 0 = chỉ lưu khi bấm nút. Mặc định 1 giờ. */
  chuKyExcel?: number;
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
  const kho = new KhoDonKinh(opts.dbPath);
  const today = opts.today ?? homNayTheoMay;
  const webDir = opts.webDir ?? join(ROOT, 'dist', 'web');
  const bayGio = opts.bayGio ?? Date.now;
  const dongBo = opts.kenhSheet ? new DongBo(kho, opts.kenhSheet, bayGio, opts.ghiLog) : undefined;

  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', 'http://localhost');
      if (url.pathname.startsWith('/api/')) return await xuLyApi(req, res, url);
      return await phucVuGiaoDien(res, url.pathname);
    } catch (e) {
      guiJson(res, 500, { loi: 'Lỗi máy chủ', chiTiet: String(e) });
    }
  });

  async function xuLyApi(req: IncomingMessage, res: ServerResponse, url: URL) {
    if (url.pathname === '/api/dang-nhap' && req.method === 'POST') {
      const body = await docJson(req);
      if (!dungTaiKhoan(opts.taiKhoan, body.ten, body.matKhau)) {
        return guiJson(res, 401, { loi: 'Sai tên đăng nhập hoặc mật khẩu' });
      }
      const ma = taoMaPhien();
      kho.taoPhien(bamMaPhien(ma), bayGio() + THOI_HAN_MS);
      res.setHeader('set-cookie', cookiePhien(ma, THOI_HAN_MS / 1000));
      return guiJson(res, 200, { ten: opts.taiKhoan.ten });
    }
    const ma = docMaPhien(req);
    if (url.pathname === '/api/dang-xuat' && req.method === 'POST') {
      if (ma) kho.xoaPhien(bamMaPhien(ma));
      res.setHeader('set-cookie', cookiePhien('', 0));
      return guiJson(res, 200, {});
    }
    if (!ma || !kho.phienConHan(bamMaPhien(ma), bayGio())) {
      return guiJson(res, 401, { loi: 'Cần đăng nhập' });
    }
    if (url.pathname === '/api/xuat-excel' && req.method === 'POST') {
      if (!opts.thuMucExcel) return guiJson(res, 400, { loi: 'Máy này chưa cấu hình thư mục lưu Excel' });
      try {
        return guiJson(res, 200, { duongDan: await luuExcel() });
      } catch (e) {
        return guiJson(res, 500, { loi: (e as Error).message });
      }
    }
    if (url.pathname === '/api/dia-chi' && req.method === 'GET') {
      // Link để mở app trên thiết bị khác cùng mạng (điện thoại, máy khác)
      const dc = (opts.diaChiMang ?? diaChiMangNoiBo)();
      return guiJson(res, 200, { links: dc.map((ip) => `http://${ip}:${port}`) });
    }
    if (url.pathname === '/api/dong-bo' && req.method === 'GET') {
      // Không hiện trên giao diện (quyết định của chủ cửa hàng); giữ để bật cảnh báo sau này.
      return guiJson(res, 200, {
        coSheet: !!dongBo,
        soChoDay: kho.choDay().length,
        lanCuoiThanhCong: Number(kho.trangThai('lanCuoiThanhCong')) || null,
        loiCuoi: kho.trangThai('loiCuoi') ?? null,
      });
    }
    if (url.pathname === '/api/phien' && req.method === 'GET') {
      return guiJson(res, 200, { ten: opts.taiKhoan.ten });
    }
    if (url.pathname === '/api/don-kinh' && req.method === 'GET') {
      const ngay = url.searchParams.get('ngayDat') ?? today();
      return guiJson(res, 200, kho.theoNgayDat(ngay));
    }
    if (url.pathname === '/api/don-kinh' && req.method === 'POST') {
      const body = await docJson(req);
      const ten = chuanHoa('ten', body.ten);
      if (!ten.ok) return guiJson(res, 400, { loi: ten.loi });
      const ngay = chuanHoa('ngayDat', body.ngayDat || today());
      if (!ngay.ok) return guiJson(res, 400, { loi: ngay.loi });
      return guiJson(res, 201, kho.tao(ten.value, ngay.value));
    }
    if (url.pathname === '/api/danh-sach' && req.method === 'GET') {
      return guiJson(res, 200, kho.danhSach());
    }
    const dsm = url.pathname.match(/^\/api\/danh-sach\/([^/]+)$/);
    if (dsm && req.method === 'POST') {
      const loai = decodeURIComponent(dsm[1]!);
      if (!laLoaiDanhSach(loai) || !DANH_SACH_THEM_DUOC.includes(loai)) {
        return guiJson(res, 400, { loi: `Không thêm được giá trị mới vào danh sách "${loai}"` });
      }
      const body = await docJson(req);
      const kq = themVaoDanhSach(kho.danhSach()[loai], body.giaTri);
      if (!kq.ok) return guiJson(res, 400, { loi: kq.loi });
      if (kq.moi) kho.themVaoDanhSach(loai, kq.ds[kq.ds.length - 1]!);
      return guiJson(res, 201, kho.danhSach()[loai]);
    }
    if (url.pathname === '/api/lich' && req.method === 'GET') {
      const thang = url.searchParams.get('thang') ?? today().slice(0, 7);
      if (!laThang(thang)) return guiJson(res, 400, { loi: 'Tháng phải có dạng YYYY-MM' });
      return guiJson(res, 200, demTheoNgay(kho.tatCa(), thang));
    }
    if (url.pathname === '/api/tong' && req.method === 'GET') {
      const thang = url.searchParams.get('thang') ?? '';
      if (thang && !laThang(thang)) return guiJson(res, 400, { loi: 'Tháng phải có dạng YYYY-MM' });
      return guiJson(res, 200, timDon(kho.tatCa(), url.searchParams.get('q') ?? '', thang));
    }
    if (url.pathname === '/api/su-co' && req.method === 'GET') {
      return guiJson(res, 200, suCo(kho.tatCa()));
    }
    if (url.pathname === '/api/kinh-hen' && req.method === 'GET') {
      return guiJson(res, 200, kinhHen(kho.tatCa()));
    }
    if (url.pathname === '/api/den-hen' && req.method === 'GET') {
      return guiJson(res, 200, denHen(kho.tatCa(), today()));
    }
    if (url.pathname === '/api/thung-rac' && req.method === 'GET') {
      return guiJson(res, 200, kho.thungRac());
    }
    const tr = url.pathname.match(/^\/api\/don-kinh\/([^/]+)\/(thung-rac|khoi-phuc)$/);
    if (tr && req.method === 'POST') {
      const don = kho.datThungRac(decodeURIComponent(tr[1]!), tr[2] === 'thung-rac');
      if (!don) return guiJson(res, 404, { loi: 'Không tìm thấy Đơn kính' });
      return guiJson(res, 200, don);
    }
    const ht = url.pathname.match(/^\/api\/don-kinh\/([^/]+)\/hoan-thanh$/);
    if (ht && req.method === 'POST') {
      const don = kho.lay(decodeURIComponent(ht[1]!));
      if (!don) return guiJson(res, 404, { loi: 'Không tìm thấy Đơn kính' });
      return guiJson(res, 200, kho.sua(don.id, 'ttKinh', DA_TRA));
    }
    const m = url.pathname.match(/^\/api\/don-kinh\/([^/]+)$/);
    if (m && req.method === 'PATCH') {
      const id = decodeURIComponent(m[1]!);
      const body = await docJson(req);
      const field = String(body.field ?? '');
      if (!laTruongSuaDuoc(field)) return guiJson(res, 400, { loi: `Không sửa được trường "${field}"` });
      const v = chuanHoa(field, body.value);
      if (!v.ok) return guiJson(res, 400, { loi: v.loi });
      const don = kho.sua(id, field, v.value);
      if (!don) return guiJson(res, 404, { loi: 'Không tìm thấy Đơn kính' });
      return guiJson(res, 200, don);
    }
    return guiJson(res, 404, { loi: 'Không có API này' });
  }

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

  /** Lưu file Excel của hôm nay (ghi đè trong ngày). */
  const luuExcel = () => xuatExcel(kho.tatCa(), opts.thuMucExcel!, today());
  let henExcel: ReturnType<typeof setInterval> | undefined;
  const chuKyExcel = opts.chuKyExcel ?? 60 * 60_000;
  if (opts.thuMucExcel && chuKyExcel > 0) {
    const tuLuu = () => luuExcel().then((f) => opts.ghiLog?.(`Đã lưu Excel: ${f}`), (e) => opts.ghiLog?.(`Lưu Excel lỗi: ${(e as Error).message}`));
    void tuLuu();
    henExcel = setInterval(tuLuu, chuKyExcel);
    henExcel.unref?.();
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
        if (henExcel) clearInterval(henExcel);
        server.closeAllConnections();
        server.close((err) => {
          kho.dong();
          err ? reject(err) : resolve();
        });
      }),
  };
}

function guiJson(res: ServerResponse, status: number, data: unknown) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

async function docJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  if (!chunks.length) return {};
  try {
    const v = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
}
