// Quy tắc Đơn kính dùng chung cho giao diện, exe và Apps Script.
// Thuần: không đụng DOM, lưu trữ hay mạng. Thuật ngữ theo GLOSSARY.md.

export const TRUONG_SUA_DUOC = [
  'ten', 'tuoi', 'sdt',
  'mp', 'mt', 'add',
  'hang', 'loai', 'nguon',
  'ngayDat', 'ngayHen',
  'ttTrong', 'ttKinh',
  'tuVan', 'cat', 'phanHoi',
  'shipTime', 'diaChi', 'ghiChu',
] as const;

export type TruongSuaDuoc = (typeof TRUONG_SUA_DUOC)[number];

export type DonKinh = { id: string } & Record<TruongSuaDuoc, string>;

export const NHAN: Record<TruongSuaDuoc, string> = {
  ten: 'Tên', tuoi: 'Tuổi', sdt: 'SĐT',
  mp: 'MP', mt: 'MT', add: 'ADD',
  hang: 'Hãng', loai: 'Loại tròng', nguon: 'Nguồn tròng',
  ngayDat: 'Ngày đặt', ngayHen: 'Ngày hẹn',
  ttTrong: 'Tình trạng tròng', ttKinh: 'Tình trạng kính',
  tuVan: 'Người tư vấn', cat: 'Người cắt', phanHoi: 'Phản hồi',
  shipTime: 'Thời gian ship', diaChi: 'Địa chỉ ship', ghiChu: 'Ghi chú',
};

export const TT_TRONG_MAC_DINH = 'Chưa đặt';
export const TT_KINH_MAC_DINH = 'Chưa cắt';

const NGAY = /^\d{4}-\d{2}-\d{2}$/;

export function laTruongSuaDuoc(f: string): f is TruongSuaDuoc {
  return (TRUONG_SUA_DUOC as readonly string[]).includes(f);
}

/** Chuẩn hóa một giá trị trước khi lưu; trả về lỗi dạng chữ nếu không hợp lệ. */
export function chuanHoa(field: TruongSuaDuoc, value: unknown): { ok: true; value: string } | { ok: false; loi: string } {
  const v = String(value ?? '').trim();
  if (field === 'ten') {
    if (!v) return { ok: false, loi: 'Tên không được để trống' };
    return { ok: true, value: v.toLocaleUpperCase('vi-VN') };
  }
  if ((field === 'ngayDat' || field === 'ngayHen') && v && !NGAY.test(v)) {
    return { ok: false, loi: `${NHAN[field]} phải có dạng YYYY-MM-DD` };
  }
  if (field === 'ngayDat' && !v) return { ok: false, loi: 'Ngày đặt không được để trống' };
  return { ok: true, value: v };
}

/** Đơn kính mới chỉ từ tên; các trường khác để trống trừ Ngày đặt và hai tình trạng mặc định. */
export function donMoi(id: string, ten: string, ngayDat: string): DonKinh {
  const don = Object.fromEntries(TRUONG_SUA_DUOC.map((f) => [f, ''])) as Record<TruongSuaDuoc, string>;
  return { ...don, id, ten, ngayDat, ttTrong: TT_TRONG_MAC_DINH, ttKinh: TT_KINH_MAC_DINH };
}
