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

// ---- Kính hẹn, Đến hẹn, Hoàn thành ----

/** Hoàn thành = Tình trạng kính "Đã trả" (không phải một trường riêng). */
export const DA_TRA = 'Đã trả';

/** Phải có trước khi Hoàn thành: mọi trường trừ ADD, thời gian ship, địa chỉ ship, ghi chú (và Tình trạng kính, do Hoàn thành tự đặt). */
export const TRUONG_BAT_BUOC: readonly TruongSuaDuoc[] = [
  'ten', 'tuoi', 'sdt', 'mp', 'mt', 'hang', 'loai', 'nguon', 'ngayDat', 'ngayHen', 'ttTrong', 'tuVan', 'cat', 'phanHoi',
];

const trong = (v: string | undefined) => !v || !v.trim();

export const daHoanThanh = (d: DonKinh) => d.ttKinh === DA_TRA;
export const laKinhHen = (d: DonKinh) => !trong(d.ngayHen) && !daHoanThanh(d);
export const truongConThieu = (d: DonKinh) => TRUONG_BAT_BUOC.filter((f) => trong(d[f]));

export type MucGap = 'qua' | 'gan' | 'sap' | '';

export function soNgay(tu: string, den: string) {
  return Math.round((Date.parse(den) - Date.parse(tu)) / 864e5);
}

/** Mức gấp của một Kính hẹn so với hôm nay: quá hẹn, hôm nay/ngày mai, còn 2–5 ngày. */
export function mucGap(d: DonKinh, homNay: string): MucGap {
  if (trong(d.ngayHen)) return '';
  const n = soNgay(homNay, d.ngayHen);
  return n < 0 ? 'qua' : n <= 1 ? 'gan' : n <= 5 ? 'sap' : '';
}

export const SU_CO = 'Sự cố';
export const laSuCo = (d: DonKinh) => d.phanHoi === SU_CO;

/** Đơn kính có Phản hồi = Sự cố; mới đặt nhất lên đầu. */
export function suCo(ds: DonKinh[]): DonKinh[] {
  return ds.filter(laSuCo).sort((a, b) => b.ngayDat.localeCompare(a.ngayDat));
}

/** Mọi Kính hẹn; hẹn sớm nhất lên đầu. */
export function kinhHen(ds: DonKinh[]): DonKinh[] {
  return ds.filter(laKinhHen).sort((a, b) => a.ngayHen.localeCompare(b.ngayHen));
}

/** Kính hẹn có Ngày hẹn hôm nay hoặc đã qua; Ngày hẹn gần hôm nay nhất lên trước. */
export function denHen(ds: DonKinh[], homNay: string): DonKinh[] {
  return ds
    .filter((d) => laKinhHen(d) && d.ngayHen <= homNay)
    .sort((a, b) => b.ngayHen.localeCompare(a.ngayHen));
}

export type KetQuaHoanThanh = { ok: true; don: DonKinh } | { ok: false; thieu: TruongSuaDuoc[]; loi: string };

export function hoanThanh(d: DonKinh): KetQuaHoanThanh {
  const thieu = truongConThieu(d);
  if (thieu.length) return { ok: false, thieu, loi: `Còn thiếu: ${thieu.map((f) => NHAN[f]).join(', ')}` };
  return { ok: true, don: { ...d, ttKinh: DA_TRA } };
}

// ---- Danh sách lựa chọn ----

export const DANH_SACH_MAC_DINH = {
  hang: ['ESSILOR', 'ZEISS', 'FANO', 'HOYA', 'KIỂM SOÁT CẬN THỊ', 'CHEMI', 'IO'],
  nguon: ['Kính sẵn', 'Ký gửi', 'Kính đặt', 'Đặt đánh'],
  ttTrong: ['Chưa đặt', 'Đã đặt – đang giao', 'Đã có'],
  ttKinh: ['Chưa cắt', 'Đã cắt – chưa trả', 'Ship', 'Đã trả'],
  phanHoi: ['Tốt', 'Không tốt', 'Sự cố', 'Khác'],
  // Tên nhân viên thật không nằm trong mã nguồn (repo public): thêm qua "Khác…" hoặc tab Danh sách của Sheet.
  nhanVien: [] as string[],
} satisfies Record<string, string[]>;

export type LoaiDanhSach = keyof typeof DANH_SACH_MAC_DINH;
export type DanhSach = Record<LoaiDanhSach, string[]>;

/** Trường nào chọn từ danh sách nào. */
export const DANH_SACH_CUA_TRUONG: Partial<Record<TruongSuaDuoc, LoaiDanhSach>> = {
  hang: 'hang', nguon: 'nguon', ttTrong: 'ttTrong', ttKinh: 'ttKinh', phanHoi: 'phanHoi', tuVan: 'nhanVien', cat: 'nhanVien',
};

/** Danh sách nào cho thêm giá trị mới bằng "Khác…" ngay khi nhập đơn. */
export const DANH_SACH_THEM_DUOC: readonly LoaiDanhSach[] = ['hang', 'nguon', 'nhanVien'];

export const laLoaiDanhSach = (s: string): s is LoaiDanhSach => s in DANH_SACH_MAC_DINH;

/** Thêm một giá trị vào danh sách: bỏ khoảng trắng thừa, không thêm trùng (không phân biệt hoa thường). */
export function themVaoDanhSach(ds: readonly string[], giaTri: unknown): { ok: true; ds: string[]; moi: boolean } | { ok: false; loi: string } {
  const v = String(giaTri ?? '').trim().replace(/\s+/g, ' ');
  if (!v) return { ok: false, loi: 'Giá trị mới không được để trống' };
  const daCo = ds.some((x) => x.toLocaleLowerCase('vi-VN') === v.toLocaleLowerCase('vi-VN'));
  return { ok: true, ds: daCo ? [...ds] : [...ds, v], moi: !daCo };
}

/** Gợi ý Loại tròng: các loại đã nhập, không trùng, theo thứ tự xuất hiện. */
export function goiYLoaiTrong(ds: DonKinh[]): string[] {
  return [...new Set(ds.map((d) => d.loai.trim()).filter(Boolean))];
}
