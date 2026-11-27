// Phía Google Sheet của giao kèo đồng bộ (src/core/dong-bo.ts), viết trên một bảng tính trừu tượng
// để test được trên máy; src/apps-script/gas.ts nối nó vào SpreadsheetApp thật.
//
// Cấu trúc Sheet:
//   "Đơn kính"   hàng 1 là tiêu đề: Mã đơn | <các trường theo NHAN> | Thùng rác. Mỗi Đơn kính một dòng.
//   "Danh sách"  mỗi cột một danh sách lựa chọn (Hãng, Nguồn tròng, …, Nhân viên).
//   "Cài đặt"    cột A tên, cột B giá trị: Tên đăng nhập, Mật khẩu, Khóa Máy quầy.
//   "_Nhật ký"   (ẩn) mỗi ô thay đổi một dòng: Mã đơn | Trường | Giá trị | Lúc. Số dòng = mốc đồng bộ.
import { DANH_SACH_MAC_DINH, NHAN, TRUONG_SUA_DUOC } from '../core/don-kinh.js';
import { TRUONG_DONG_BO, laTruongDongBo, type ThayDoiO, type TruongDongBo } from '../core/dong-bo.js';

export const TAB = { don: 'Đơn kính', danhSach: 'Danh sách', caiDat: 'Cài đặt', nhatKy: '_Nhật ký' } as const;

const TIEU_DE_DON = ['Mã đơn', ...TRUONG_SUA_DUOC.map((f) => NHAN[f]), 'Thùng rác'];
const TRUONG_THEO_COT: (TruongDongBo | 'id')[] = ['id', ...TRUONG_DONG_BO];
const TIEU_DE_DANH_SACH: Record<keyof typeof DANH_SACH_MAC_DINH, string> = {
  hang: 'Hãng', nguon: 'Nguồn tròng', ttTrong: 'Tình trạng tròng', ttKinh: 'Tình trạng kính', phanHoi: 'Phản hồi', nhanVien: 'Nhân viên',
};
export const CAI_DAT = { ten: 'Tên đăng nhập', matKhau: 'Mật khẩu', khoa: 'Khóa Máy quầy' } as const;

/** Bảng tính tối thiểu mà phần xử lý cần. Hàng/cột đánh số từ 0; mọi giá trị là chữ. */
export interface BangTinh {
  coTab(ten: string): boolean;
  /** Tạo tab với hàng tiêu đề; ô ở tab này luôn giữ dạng chữ (không tự đổi ngày/số). */
  taoTab(ten: string, tieuDe: string[], an?: boolean): void;
  doc(ten: string): string[][];
  ghiO(ten: string, hang: number, cot: number, giaTri: string): void;
  themHang(ten: string, giaTri: string[]): void;
}

/** Tạo các tab còn thiếu; lần đầu tạo khóa Máy quầy và mật khẩu ngẫu nhiên. Chạy lại an toàn. */
export function khoiTao(b: BangTinh, ngauNhien: () => string) {
  if (!b.coTab(TAB.don)) b.taoTab(TAB.don, TIEU_DE_DON);
  if (!b.coTab(TAB.nhatKy)) b.taoTab(TAB.nhatKy, ['Mã đơn', 'Trường', 'Giá trị', 'Lúc'], true);
  if (!b.coTab(TAB.danhSach)) {
    const loai = Object.keys(TIEU_DE_DANH_SACH) as (keyof typeof DANH_SACH_MAC_DINH)[];
    b.taoTab(TAB.danhSach, loai.map((k) => TIEU_DE_DANH_SACH[k]));
    const dai = Math.max(...loai.map((k) => DANH_SACH_MAC_DINH[k].length));
    for (let i = 0; i < dai; i++) b.themHang(TAB.danhSach, loai.map((k) => DANH_SACH_MAC_DINH[k][i] ?? ''));
  }
  if (!b.coTab(TAB.caiDat)) {
    b.taoTab(TAB.caiDat, ['Cài đặt', 'Giá trị']);
    b.themHang(TAB.caiDat, [CAI_DAT.ten, 'cuahang']);
    b.themHang(TAB.caiDat, [CAI_DAT.matKhau, ngauNhien()]);
    b.themHang(TAB.caiDat, [CAI_DAT.khoa, ngauNhien() + ngauNhien()]);
  }
}

export function docCaiDat(b: BangTinh): Record<string, string> {
  return Object.fromEntries(b.doc(TAB.caiDat).slice(1).map((h) => [h[0] ?? '', h[1] ?? '']));
}

/** Ghi các ô lên tab Đơn kính (tạo dòng cho đơn mới), mỗi ô ghi thêm một dòng nhật ký. */
export function day(b: BangTinh, thayDoi: ThayDoiO[], luc: string) {
  const bang = b.doc(TAB.don);
  const hangCua = new Map(bang.slice(1).map((h, i) => [h[0], i + 1]));
  for (const o of thayDoi) {
    if (!laTruongDongBo(o.truong) || !o.id) continue;
    let hang = hangCua.get(o.id);
    if (hang === undefined) {
      const moi = TRUONG_THEO_COT.map((t) => (t === 'id' ? o.id : ''));
      b.themHang(TAB.don, moi);
      hang = bang.length;
      bang.push(moi);
      hangCua.set(o.id, hang);
    }
    b.ghiO(TAB.don, hang, TRUONG_THEO_COT.indexOf(o.truong), String(o.giaTri ?? ''));
    b.themHang(TAB.nhatKy, [o.id, o.truong, String(o.giaTri ?? ''), luc]);
  }
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

/** Ai đó sửa thẳng một ô ở tab Đơn kính (trigger onEdit): ghi nhật ký để Máy quầy kéo về. */
export function ghiNhanSuaTay(b: BangTinh, tab: string, hang: number, cot: number, giaTri: string, luc: string) {
  if (tab !== TAB.don || hang < 1) return;
  const truong = TRUONG_THEO_COT[cot];
  if (!truong || truong === 'id') return;
  const id = b.doc(TAB.don)[hang]?.[0];
  if (!id) return;
  b.themHang(TAB.nhatKy, [id, truong, giaTri, luc]);
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
  if (y.hanhDong === 'keo') return { ok: true, ...keo(b, Number(y.moc ?? 0)) };
  return { ok: false, loi: `Không rõ hành động "${y.hanhDong}"` };
}
