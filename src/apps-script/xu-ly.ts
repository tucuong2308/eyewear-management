// Phía Google Sheet của giao kèo đồng bộ (src/core/dong-bo.ts), viết trên một bảng tính trừu tượng
// để test được trên máy; src/apps-script/gas.ts nối nó vào SpreadsheetApp thật.
//
// Cấu trúc Sheet (giống file mẫu "Gốc Danh sách kính", xem src/core/bo-cuc.ts):
//   "TỔNG"       mỗi Đơn kính một dòng; cột theo mẫu cũ (Nguồn tròng là 4 ô tick) + NGUỒN KHÁC, THÙNG RÁC, MÃ ĐƠN.
//   "KÍNH HẸN", "SỰ CỐ"  chỉ để xem: công thức lọc từ TỔNG, không chép đơn ra nên không lệch, không nhân đôi.
//   "Danh sách"  mỗi cột một danh sách lựa chọn (Hãng, Nguồn tròng, …, Nhân viên).
//   "Cài đặt"    cột A tên, cột B giá trị: Tên đăng nhập, Mật khẩu, Khóa Máy quầy.
//   "_Nhật ký"   (ẩn) mỗi ô thay đổi một dòng: Mã đơn | Trường | Giá trị | Lúc. Số dòng = mốc đồng bộ.
import { DANH_SACH_MAC_DINH, DA_TRA, NHAN_DANH_SACH as TIEU_DE_DANH_SACH, SU_CO, donMoi, type DonKinh } from '../core/don-kinh.js';
import { laTruongDongBo, type ThayDoiO, type TruongDongBo } from '../core/dong-bo.js';
import { COT_TONG, TIEU_DE_TONG, cotTheoTieuDe, donTuHang, hangTheoTieuDe, laDung, tabXem, truongCuaCot } from '../core/bo-cuc.js';

export const TAB = { don: 'TỔNG', danhSach: 'Danh sách', caiDat: 'Cài đặt', nhatKy: '_Nhật ký' } as const;
export const TAB_XEM = tabXem(TAB.don, DA_TRA, SU_CO);
export const CAI_DAT = { ten: 'Tên đăng nhập', matKhau: 'Mật khẩu', khoa: 'Khóa Máy quầy' } as const;

/** Bảng tính tối thiểu mà phần xử lý cần. Hàng/cột đánh số từ 0; mọi giá trị là chữ (ô tick: "TRUE"/"FALSE"). */
export interface BangTinh {
  coTab(ten: string): boolean;
  /** Tạo tab với hàng tiêu đề; ô luôn giữ dạng chữ (không tự đổi ngày/số), trừ các cột `cotTick` là ô tick. */
  taoTab(ten: string, tieuDe: string[], tuyChon?: { an?: boolean; cotTick?: number[] }): void;
  doc(ten: string): string[][];
  /** Ghi một vùng chữ nhật bắt đầu ở hàng `hangDau`, cột `cotDau` (mặc định 0), một lần gọi Google. */
  ghiVung(ten: string, hangDau: number, giaTri: string[][], cotDau?: number): void;
  /** Khóa một cột (trừ hàng tiêu đề): chỉ chủ Sheet (và script chạy bằng tài khoản chủ) sửa được. Chạy lại an toàn. */
  khoaCot(ten: string, cot: number, moTa: string): void;
  /** Thêm các hàng vào cuối tab (một lần gọi Google). */
  themHang(ten: string, hang: string[][]): void;
  /** Đặt công thức vào một ô. */
  ghiCongThuc(ten: string, hang: number, cot: number, congThuc: string): void;
}

const COT_TICK = COT_TONG.flatMap((c, i) => (c.loai === 'tick' ? [i] : []));
export const KHOA_MA_DON = 'MÃ ĐƠN do app tự điền, không sửa tay';

/** Tạo các tab còn thiếu; lần đầu tạo khóa Máy quầy và mật khẩu ngẫu nhiên. Chạy lại an toàn. */
export function khoiTao(b: BangTinh, ngauNhien: () => string) {
  if (!b.coTab(TAB.don)) b.taoTab(TAB.don, TIEU_DE_TONG, { cotTick: COT_TICK });
  // Mã đơn do app tạo, nối một đơn ở exe, bản online và Sheet: không cho sửa nhầm (#13)
  b.khoaCot(TAB.don, COT_TONG.findIndex((c) => c.loai === 'id'), KHOA_MA_DON);
  for (const x of TAB_XEM) {
    if (!b.coTab(x.ten)) b.taoTab(x.ten, x.tieuDe);
    // luôn ghi lại công thức: chạy lại caiDat là sửa được tab lọc bị hỏng
    b.ghiCongThuc(x.ten, 1, 0, x.congThuc);
  }
  if (!b.coTab(TAB.nhatKy)) b.taoTab(TAB.nhatKy, ['Mã đơn', 'Trường', 'Giá trị', 'Lúc'], { an: true });
  if (!b.coTab(TAB.danhSach)) {
    const loai = Object.keys(TIEU_DE_DANH_SACH) as (keyof typeof DANH_SACH_MAC_DINH)[];
    b.taoTab(TAB.danhSach, loai.map((k) => TIEU_DE_DANH_SACH[k]));
    const dai = Math.max(...loai.map((k) => DANH_SACH_MAC_DINH[k].length));
    b.themHang(TAB.danhSach, Array.from({ length: dai }, (_, i) => loai.map((k) => DANH_SACH_MAC_DINH[k][i] ?? '')));
  }
  if (!b.coTab(TAB.caiDat)) {
    b.taoTab(TAB.caiDat, ['Cài đặt', 'Giá trị']);
    b.themHang(TAB.caiDat, [
      [CAI_DAT.ten, 'cuahang'],
      [CAI_DAT.matKhau, ngauNhien()],
      [CAI_DAT.khoa, ngauNhien() + ngauNhien()],
    ]);
  }
}

export function docCaiDat(b: BangTinh): Record<string, string> {
  return Object.fromEntries(b.doc(TAB.caiDat).slice(1).map((h) => [h[0] ?? '', h[1] ?? '']));
}

/** Gán một ô đồng bộ vào Đơn kính. */
function gan(d: DonKinh, truong: TruongDongBo, giaTri: string) {
  if (truong === 'thungRac') d.thungRac = !!giaTri;
  else d[truong] = giaTri;
}

/** Ghi các ô lên tab TỔNG (tạo dòng cho đơn mới), mỗi ô thêm một dòng nhật ký. */
export function day(b: BangTinh, thayDoi: ThayDoiO[], luc: string) {
  // Mỗi lần gọi Google mất cỡ chục đến trăm ms, nên sửa trong bộ nhớ rồi ghi gộp:
  // mỗi cụm dòng liền nhau một lần, nhật ký một lần. Dòng không đổi thì không ghi lại.
  const doc = b.doc(TAB.don);
  const tieuDe = doc[0] ?? TIEU_DE_TONG;
  const bang = doc.map((h) => Array.from({ length: tieuDe.length }, (_, c) => h[c] ?? ''));
  const hangCua = new Map(bang.slice(1).map((h, i) => [donTuHang(tieuDe, h).id, i + 1]));
  const doi = new Set<number>();
  const nhatKy: string[][] = [];
  for (const o of thayDoi) {
    if (!laTruongDongBo(o.truong) || !o.id) continue;
    let hang = hangCua.get(o.id);
    const d = hang === undefined ? { ...donMoi(o.id, '', ''), ttTrong: '', ttKinh: '' } : donTuHang(tieuDe, bang[hang]!);
    if (hang === undefined) {
      hang = bang.length;
      bang.push([]);
      hangCua.set(o.id, hang);
    }
    const giaTri = String(o.giaTri ?? '');
    gan(d, o.truong, giaTri);
    bang[hang] = hangTheoTieuDe(tieuDe, d, bang[hang]);
    doi.add(hang);
    nhatKy.push([o.id, o.truong, giaTri, luc]);
  }
  const hangDoi = [...doi].sort((x, y) => x - y);
  for (let i = 0; i < hangDoi.length; ) {
    let k = i;
    while (k + 1 < hangDoi.length && hangDoi[k + 1] === hangDoi[k]! + 1) k++;
    b.ghiVung(TAB.don, hangDoi[i]!, bang.slice(hangDoi[i], hangDoi[k]! + 1));
    i = k + 1;
  }
  if (nhatKy.length) b.themHang(TAB.nhatKy, nhatKy);
}

/** Các ô đổi sau mốc (mốc = số dòng nhật ký đã đọc), cùng mốc mới. */
export function keo(b: BangTinh, moc: number) {
  const nk = b.doc(TAB.nhatKy).slice(1);
  const tu = Math.max(0, Math.floor(Number(moc) || 0));
  const thayDoi = nk.slice(tu)
    .filter((h) => laTruongDongBo(h[1] ?? ''))
    .map((h) => ({ id: h[0]!, truong: h[1] as TruongDongBo, giaTri: h[2] ?? '' }));
  return { thayDoi, moc: nk.length };
}

/**
 * Ai đó sửa thẳng một ô ở tab TỔNG (trigger onEdit): ghi nhật ký để Máy quầy kéo về.
 * Tick một ô nguồn tròng thì bỏ tick các ô nguồn khác (mỗi đơn một nguồn).
 */
export function ghiNhanSuaTay(b: BangTinh, tab: string, hang: number, cot: number, giaTri: string, luc: string) {
  if (tab !== TAB.don || hang < 1) return;
  const bang = b.doc(TAB.don);
  const tieuDe = bang[0] ?? [];
  const c = cotTheoTieuDe(tieuDe[cot] ?? '');
  const dong = bang[hang];
  if (!c || !dong) return;
  const truong = truongCuaCot(c);
  if (truong === 'id') return;
  const d = donTuHang(tieuDe, dong);
  if (!d.id) return;
  if (c.loai === 'tick') {
    d.nguon = laDung(giaTri) ? c.nguon : d.nguon === c.nguon ? '' : d.nguon;
    // Chỉ ghi ô đổi (các ô tick, NGUỒN KHÁC): người sửa có thể không có quyền ghi cột MÃ ĐƠN đã khóa
    const moi = hangTheoTieuDe(tieuDe, d, dong);
    moi.forEach((v, i) => {
      if (v !== (dong[i] ?? '')) b.ghiVung(TAB.don, hang, [[v]], i);
    });
  }
  const v = truong === 'nguon' ? d.nguon : truong === 'thungRac' ? (d.thungRac ? '1' : '') : giaTri.trim();
  b.themHang(TAB.nhatKy, [[d.id, truong, v, luc]]);
}

/** Xử lý một yêu cầu HTTP (body JSON) theo giao kèo; luôn trả object để gửi về dạng JSON. */
export function xuLyYeuCau(b: BangTinh, body: unknown, luc: string): Record<string, unknown> {
  const y = (body ?? {}) as { hanhDong?: string; khoa?: string; thayDoi?: ThayDoiO[]; moc?: number };
  const khoa = docCaiDat(b)[CAI_DAT.khoa];
  if (!khoa || y.khoa !== khoa) return { ok: false, loi: 'Sai khóa Máy quầy' };
  if (y.hanhDong === 'day') {
    day(b, Array.isArray(y.thayDoi) ? y.thayDoi : [], luc);
    return { ok: true };
  }
  if (y.hanhDong === 'keo') {
    // Tài khoản trong tab Cài đặt: exe và bản online dùng làm tài khoản đăng nhập (#13)
    const cd = docCaiDat(b);
    return { ok: true, ...keo(b, Number(y.moc ?? 0)), taiKhoan: { ten: cd[CAI_DAT.ten] ?? '', matKhau: cd[CAI_DAT.matKhau] ?? '' } };
  }
  return { ok: false, loi: `Không rõ hành động "${y.hanhDong}"` };
}
