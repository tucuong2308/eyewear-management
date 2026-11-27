// Chuyển một dòng của sheet TỔNG (file "DANH SÁCH KÍNH 11/2026") thành Đơn kính.
// Thuần: không đọc file, không lưu. Quy tắc theo spec #1 (user story 62, 63).
import { TRUONG_SUA_DUOC, type DonKinh, type TruongSuaDuoc } from './don-kinh.js';

/** Giá trị một ô đã chuẩn hóa từ Excel: ngày là Date (theo UTC), số, chữ, đúng/sai hoặc trống. */
export type GiaTriO = string | number | boolean | Date | null | undefined;

// Thứ tự cột A..X của sheet TỔNG
const COT = [
  'phanHoi', 'ten', 'tuoi', 'sdt', 'mp', 'mt', 'add', 'hang', 'loai',
  'kinhSan', 'kyGui', 'kinhDat', 'datDanh', 'ngayDat', 'ngayHen', 'ttTrong', 'ttKinh',
  'shipTime', 'diaChi', 'tuVan', 'cat', 'ghiChu', 'maCu', 'doneCu',
] as const;

const PHAN_HOI: Record<string, string> = { 'TÍCH CỰC': 'Tốt', 'SỰ CỐ': 'Sự cố' };
const TT_TRONG: Record<string, string> = { 'CHƯA ĐẶT': 'Chưa đặt', 'ĐÃ ĐẶT - ĐANG GIAO': 'Đã đặt – đang giao', 'ĐÃ CÓ': 'Đã có' };
const TT_KINH: Record<string, string> = { 'CHƯA CẮT': 'Chưa cắt', 'ĐÃ CẮT - CHƯA TRẢ': 'Đã cắt – chưa trả', SHIP: 'Ship', 'ĐÃ TRẢ': 'Đã trả' };
const NGUON: [string, string][] = [['kinhSan', 'Kính sẵn'], ['kyGui', 'Ký gửi'], ['kinhDat', 'Kính đặt'], ['datDanh', 'Đặt đánh']];

export const DANH_DAU_NGUON = '[KIỂM TRA NGUỒN TRÒNG]';

const p2 = (n: number) => String(n).padStart(2, '0');
const ngayIso = (d: Date) => `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())}`;

function chu(v: GiaTriO): string {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return `${p2(v.getUTCDate())}/${p2(v.getUTCMonth() + 1)}`;
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : String(v);
  return String(v).trim();
}

function ngay(v: GiaTriO): string {
  if (v instanceof Date) return ngayIso(v);
  const m = chu(v).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return m ? `${m[3]}-${p2(Number(m[2]))}-${p2(Number(m[1]))}` : '';
}

const laDung = (v: GiaTriO) => v === true || chu(v).toUpperCase() === 'TRUE';

export interface KetQuaChuyen {
  don: DonKinh;
  /** Người tư vấn / người cắt xuất hiện trong dòng, để thêm vào danh sách Nhân viên. */
  nhanVien: string[];
  canhBao: string[];
}

/**
 * @param dong     giá trị các ô A..X của một dòng
 * @param ngayDuPhong Ngày đặt lấy từ sheet ngày khi ô Ngày đặt trống
 * @param taoMa    tạo mã đơn khi dòng không có __KINH_ID
 */
export function chuyenDong(dong: GiaTriO[], ngayDuPhong: string, taoMa: () => string): KetQuaChuyen | null {
  const o = Object.fromEntries(COT.map((k, i) => [k, dong[i]])) as Record<(typeof COT)[number], GiaTriO>;
  const ten = chu(o.ten);
  if (!ten || ten.startsWith('VD:')) return null; // dòng trống hoặc dòng ví dụ của mẫu

  const canhBao: string[] = [];
  const nguonTick = NGUON.filter(([k]) => laDung(o[k as keyof typeof o])).map(([, v]) => v);
  const nguon = nguonTick.length === 1 ? nguonTick[0]! : '';
  if (nguonTick.length !== 1) canhBao.push(nguonTick.length ? `tick ${nguonTick.length} nguồn tròng` : 'không tick nguồn tròng');

  const ngayDat = ngay(o.ngayDat) || ngayDuPhong;
  if (!ngay(o.ngayDat)) canhBao.push(ngayDuPhong ? 'Ngày đặt lấy từ sheet ngày' : 'không có Ngày đặt');

  const tuoi = chu(o.tuoi);
  const map = (bang: Record<string, string>, v: GiaTriO, ten: string) => {
    const s = chu(v).toUpperCase();
    if (!s) return '';
    if (!(s in bang)) canhBao.push(`${ten} lạ: ${s}`);
    return bang[s] ?? chu(v);
  };

  const ghiChu = [nguonTick.length !== 1 ? DANH_DAU_NGUON : '', chu(o.ghiChu)].filter(Boolean).join(' ');
  const truong: Record<TruongSuaDuoc, string> = {
    ten: ten.toLocaleUpperCase('vi-VN'),
    tuoi: /\d/.test(tuoi) ? tuoi : '',
    sdt: chu(o.sdt),
    mp: chu(o.mp), mt: chu(o.mt), add: chu(o.add), // độ kính giữ nguyên như đang gõ
    hang: chu(o.hang), loai: chu(o.loai), nguon,
    ngayDat, ngayHen: ngay(o.ngayHen),
    ttTrong: map(TT_TRONG, o.ttTrong, 'Tình trạng tròng'),
    ttKinh: map(TT_KINH, o.ttKinh, 'Tình trạng kính'),
    tuVan: chu(o.tuVan), cat: chu(o.cat),
    phanHoi: map(PHAN_HOI, o.phanHoi, 'Phản hồi'),
    shipTime: chu(o.shipTime), diaChi: chu(o.diaChi), ghiChu,
  };
  // bảo đảm đủ mọi trường
  for (const f of TRUONG_SUA_DUOC) truong[f] ??= '';

  return {
    don: { id: chu(o.maCu) || taoMa(), thungRac: false, ...truong },
    nhanVien: [truong.tuVan, truong.cat].filter(Boolean),
    canhBao,
  };
}
