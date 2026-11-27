// API Đơn kính dùng chung cho exe trên Máy quầy (src/server/app.ts, kho file Excel) và bản online
// (src/online/worker.ts, kho D1): nhận Request, trả Response theo chuẩn web, không đụng tới Node hay Workers.
import {
  DANH_SACH_THEM_DUOC, DA_TRA, chuanHoa, demTheoNgay, denHen, kinhHen, laLoaiDanhSach, laThang, laTruongSuaDuoc,
  suCo, themVaoDanhSach, timDon, type DanhSach, type DonKinh, type LoaiDanhSach, type TruongSuaDuoc,
} from '../core/don-kinh.js';
import type { ThayDoiO } from '../core/dong-bo.js';
import {
  THOI_HAN_MS, bamMaPhien, cookiePhien, docMaPhien, dungTaiKhoan, taoMaPhien, thanhTaiKhoanBam, type TaiKhoan, type TaiKhoanBam,
} from './dang-nhap.js';

/** Một ô đã sửa nhưng chưa đẩy lên Sheet; `luc` tăng dần để biết ô có bị sửa tiếp không. */
export interface OChoDay extends ThayDoiO {
  luc: number;
}

type CoThe<T> = T | Promise<T>;

/** Kho dữ liệu: file Excel trên Máy quầy (ADR 0004) hoặc D1 ở bản online (ADR 0006). */
export interface Kho {
  danhSach(): CoThe<DanhSach & { goiYLoai: string[] }>;
  lay(id: string): CoThe<DonKinh | undefined>;
  /** Mọi đơn theo thứ tự tạo, kể cả trong Thùng rác. */
  tatCa(): CoThe<DonKinh[]>;
  thungRac(): CoThe<DonKinh[]>;
  theoNgayDat(ngay: string): CoThe<DonKinh[]>;
  tao(ten: string, ngayDat: string): Promise<DonKinh>;
  sua(id: string, field: TruongSuaDuoc, value: string): Promise<DonKinh | undefined>;
  datThungRac(id: string, thungRac: boolean): Promise<DonKinh | undefined>;
  themVaoDanhSach(loai: LoaiDanhSach, giaTri: string): Promise<void>;
  // đồng bộ với Sheet
  choDay(): CoThe<OChoDay[]>;
  xoaChoDay(da: OChoDay[]): Promise<void>;
  /** Ghi các ô kéo về từ Sheet cùng mốc mới; bỏ qua ô đang chờ đẩy (local thắng). */
  apDungTuSheet(ds: ThayDoiO[], mocMoi: number): Promise<void>;
  trangThai(khoa: string): CoThe<string | undefined>;
  datTrangThai(khoa: string, giaTri: string): Promise<void>;
  // phiên đăng nhập
  taoPhien(maBam: string, hetHan: number): Promise<void>;
  phienConHan(maBam: string, bayGio: number): CoThe<boolean>;
  xoaPhien(maBam: string): Promise<void>;
  /** Đăng xuất mọi thiết bị (khi đổi mật khẩu ở tab Cài đặt). */
  xoaMoiPhien(): Promise<void>;
}

export interface MoiTruongApi {
  kho: Kho;
  /** Tài khoản cấu hình trên máy (config.local.json / Worker secret); tài khoản từ tab Cài đặt của Sheet thắng nếu có. */
  taiKhoan: TaiKhoan;
  /** Ngày hôm nay YYYY-MM-DD theo giờ Việt Nam. */
  today(): string;
  bayGio(): number;
  /** Link mở app trên thiết bị khác (exe: địa chỉ mạng nội bộ; online: chính trang web). */
  links(url: URL): string[];
  coSheet: boolean;
  /** Bản online chạy https: cookie thêm Secure. */
  https?: boolean;
}

const json = (status: number, data: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...headers } });

async function docJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const v = JSON.parse(await req.text());
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
}

/** Lỗi mang sẵn mã HTTP (ví dụ 423 khi file Excel đang mở) được trả thẳng cho giao diện. */
export interface LoiCoMaHttp extends Error {
  maHttp: number;
}

export async function xuLyApi(req: Request, mt: MoiTruongApi): Promise<Response> {
  try {
    return await xuLy(req, mt);
  } catch (e) {
    const ma = (e as Partial<LoiCoMaHttp>).maHttp;
    if (ma) return json(ma, { loi: (e as Error).message });
    return json(500, { loi: 'Lỗi máy chủ', chiTiet: String(e) });
  }
}

/** Trạng thái lưu tài khoản kéo về từ tab Cài đặt (mật khẩu dạng băm). */
export const TT_TEN = 'tkTen';
export const TT_MAT_KHAU_BAM = 'tkMatKhauBam';

async function taiKhoanDung(mt: MoiTruongApi): Promise<TaiKhoanBam> {
  const ten = await mt.kho.trangThai(TT_TEN);
  const matKhauBam = await mt.kho.trangThai(TT_MAT_KHAU_BAM);
  return ten && matKhauBam ? { ten, matKhauBam } : thanhTaiKhoanBam(mt.taiKhoan);
}

async function xuLy(req: Request, mt: MoiTruongApi): Promise<Response> {
  const { kho } = mt;
  const url = new URL(req.url);
  const p = url.pathname;
  const m = req.method;
  const cookie = (ma: string, giay: number) => ({ 'set-cookie': cookiePhien(ma, giay, mt.https) });

  if (p === '/api/dang-nhap' && m === 'POST') {
    const body = await docJson(req);
    const tk = await taiKhoanDung(mt);
    if (!dungTaiKhoan(tk, body.ten, body.matKhau)) return json(401, { loi: 'Sai tên đăng nhập hoặc mật khẩu' });
    const ma = taoMaPhien();
    await kho.taoPhien(bamMaPhien(ma), mt.bayGio() + THOI_HAN_MS);
    return json(200, { ten: tk.ten }, cookie(ma, THOI_HAN_MS / 1000));
  }
  const ma = docMaPhien(req.headers.get('cookie'));
  if (p === '/api/dang-xuat' && m === 'POST') {
    if (ma) await kho.xoaPhien(bamMaPhien(ma));
    return json(200, {}, cookie('', 0));
  }
  if (!ma || !(await kho.phienConHan(bamMaPhien(ma), mt.bayGio()))) return json(401, { loi: 'Cần đăng nhập' });

  if (p === '/api/dia-chi' && m === 'GET') return json(200, { links: mt.links(url) });
  if (p === '/api/dong-bo' && m === 'GET') {
    // Không hiện trên giao diện (quyết định của chủ cửa hàng); giữ để bật cảnh báo sau này.
    return json(200, {
      coSheet: mt.coSheet,
      soChoDay: (await kho.choDay()).length,
      lanCuoiThanhCong: Number(await kho.trangThai('lanCuoiThanhCong')) || null,
      loiCuoi: (await kho.trangThai('loiCuoi')) ?? null,
    });
  }
  if (p === '/api/phien' && m === 'GET') return json(200, { ten: (await taiKhoanDung(mt)).ten });
  if (p === '/api/don-kinh' && m === 'GET') return json(200, await kho.theoNgayDat(url.searchParams.get('ngayDat') ?? mt.today()));
  if (p === '/api/don-kinh' && m === 'POST') {
    const body = await docJson(req);
    const ten = chuanHoa('ten', body.ten);
    if (!ten.ok) return json(400, { loi: ten.loi });
    const ngay = chuanHoa('ngayDat', body.ngayDat || mt.today());
    if (!ngay.ok) return json(400, { loi: ngay.loi });
    return json(201, await kho.tao(ten.value, ngay.value));
  }
  if (p === '/api/danh-sach' && m === 'GET') return json(200, await kho.danhSach());
  const dsm = p.match(/^\/api\/danh-sach\/([^/]+)$/);
  if (dsm && m === 'POST') {
    const loai = decodeURIComponent(dsm[1]!);
    if (!laLoaiDanhSach(loai) || !DANH_SACH_THEM_DUOC.includes(loai)) {
      return json(400, { loi: `Không thêm được giá trị mới vào danh sách "${loai}"` });
    }
    const body = await docJson(req);
    const kq = themVaoDanhSach((await kho.danhSach())[loai], body.giaTri);
    if (!kq.ok) return json(400, { loi: kq.loi });
    if (kq.moi) await kho.themVaoDanhSach(loai, kq.ds[kq.ds.length - 1]!);
    return json(201, (await kho.danhSach())[loai]);
  }
  if (p === '/api/lich' && m === 'GET') {
    const thang = url.searchParams.get('thang') ?? mt.today().slice(0, 7);
    if (!laThang(thang)) return json(400, { loi: 'Tháng phải có dạng YYYY-MM' });
    return json(200, demTheoNgay(await kho.tatCa(), thang));
  }
  if (p === '/api/tong' && m === 'GET') {
    const thang = url.searchParams.get('thang') ?? '';
    if (thang && !laThang(thang)) return json(400, { loi: 'Tháng phải có dạng YYYY-MM' });
    return json(200, timDon(await kho.tatCa(), url.searchParams.get('q') ?? '', thang));
  }
  if (p === '/api/su-co' && m === 'GET') return json(200, suCo(await kho.tatCa()));
  if (p === '/api/kinh-hen' && m === 'GET') return json(200, kinhHen(await kho.tatCa()));
  if (p === '/api/den-hen' && m === 'GET') return json(200, denHen(await kho.tatCa(), mt.today()));
  if (p === '/api/thung-rac' && m === 'GET') return json(200, await kho.thungRac());
  const tr = p.match(/^\/api\/don-kinh\/([^/]+)\/(thung-rac|khoi-phuc)$/);
  if (tr && m === 'POST') {
    const don = await kho.datThungRac(decodeURIComponent(tr[1]!), tr[2] === 'thung-rac');
    return don ? json(200, don) : json(404, { loi: 'Không tìm thấy Đơn kính' });
  }
  const ht = p.match(/^\/api\/don-kinh\/([^/]+)\/hoan-thanh$/);
  if (ht && m === 'POST') {
    const don = await kho.lay(decodeURIComponent(ht[1]!));
    if (!don) return json(404, { loi: 'Không tìm thấy Đơn kính' });
    return json(200, await kho.sua(don.id, 'ttKinh', DA_TRA));
  }
  const sm = p.match(/^\/api\/don-kinh\/([^/]+)$/);
  if (sm && m === 'PATCH') {
    const body = await docJson(req);
    const field = String(body.field ?? '');
    if (!laTruongSuaDuoc(field)) return json(400, { loi: `Không sửa được trường "${field}"` });
    const v = chuanHoa(field, body.value);
    if (!v.ok) return json(400, { loi: v.loi });
    const don = await kho.sua(decodeURIComponent(sm[1]!), field, v.value);
    return don ? json(200, don) : json(404, { loi: 'Không tìm thấy Đơn kính' });
  }
  return json(404, { loi: 'Không có API này' });
}

/** Ngày hôm nay YYYY-MM-DD theo giờ Việt Nam (máy chủ online chạy giờ UTC). */
export function homNayVietNam(bayGio = Date.now()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(new Date(bayGio));
}
