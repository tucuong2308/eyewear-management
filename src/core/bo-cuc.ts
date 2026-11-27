// Bố cục bảng TỔNG, giống file mẫu "Gốc Danh sách kính" của cửa hàng: dùng chung cho Google Sheet
// (src/apps-script) và file Excel trên Máy quầy (src/server/kho-excel.ts).
//
// Cột A–V đúng thứ tự mẫu cũ; Nguồn tròng là 4 ô tick. Thêm ở cuối: NGUỒN KHÁC (nguồn thêm qua "Khác…"),
// THÙNG RÁC, MÃ ĐƠN. Đọc theo tiêu đề cột (không theo vị trí), nhận cả tiêu đề cũ của app.
// Ô tick ghi là "TRUE"/"FALSE"; Thùng rác ghi "Có" hoặc trống.
import { NHAN, TRUONG_SUA_DUOC, type DonKinh, type TruongSuaDuoc } from './don-kinh.js';
import type { TruongDongBo } from './dong-bo.js';

export type CotTong =
  | { tieuDe: string; loai: 'truong'; truong: TruongSuaDuoc; rong?: number }
  | { tieuDe: string; loai: 'tick'; nguon: string }
  | { tieuDe: string; loai: 'nguonKhac' }
  | { tieuDe: string; loai: 'thungRac' }
  | { tieuDe: string; loai: 'id' };

const t = (tieuDe: string, truong: TruongSuaDuoc, rong?: number): CotTong => ({ tieuDe, loai: 'truong', truong, rong });
const tick = (tieuDe: string, nguon: string): CotTong => ({ tieuDe, loai: 'tick', nguon });

export const COT_TONG: readonly CotTong[] = [
  t('PHẢN HỒI', 'phanHoi'),
  t('TÊN', 'ten', 24),
  t('TUỔI', 'tuoi'),
  t('SDT LIÊN HỆ', 'sdt', 13),
  t('MP', 'mp', 18),
  t('MT', 'mt', 18),
  t('ADD (ĐA TRÒNG)', 'add'),
  t('HÃNG KÍNH', 'hang'),
  t('LOẠI KÍNH', 'loai', 22),
  tick('KÍNH SẴN', 'Kính sẵn'),
  tick('KÝ GỬI', 'Ký gửi'),
  tick('KÍNH ĐẶT', 'Kính đặt'),
  tick('ĐẶT ĐÁNH', 'Đặt đánh'),
  t('NGÀY ĐẶT', 'ngayDat'),
  t('NGÀY HẸN', 'ngayHen'),
  t('TÌNH TRẠNG MẮT', 'ttTrong', 18),
  t('TÌNH TRẠNG KÍNH', 'ttKinh', 17),
  t('THỜI GIAN ĐẶT SHIP (NẾU ĐẶT SHIP)', 'shipTime'),
  t('ĐỊA CHỈ (NẾU ĐẶT SHIP)', 'diaChi', 28),
  t('NGƯỜI TƯ VẤN - ĐẶT KÍNH', 'tuVan'),
  t('NGƯỜI CẮT KÍNH', 'cat'),
  t('GHI CHÚ', 'ghiChu', 32),
  { tieuDe: 'NGUỒN KHÁC', loai: 'nguonKhac' },
  { tieuDe: 'THÙNG RÁC', loai: 'thungRac' },
  { tieuDe: 'MÃ ĐƠN', loai: 'id' },
];

export const TIEU_DE_TONG = COT_TONG.map((c) => c.tieuDe);
export const NGUON_TICK = COT_TONG.flatMap((c) => (c.loai === 'tick' ? [c.nguon] : []));
const CO = 'Có';

/** So tiêu đề không phân biệt hoa thường, dấu cách, xuống dòng (mẫu cũ có "ADD \n(ĐA TRÒNG)", "TÌNH TRẠNG MĂT"). */
const chuanTieuDe = (s: string) => s.normalize('NFC').toLocaleUpperCase('vi-VN').replace(/\s+/g, ' ').trim();

const BI_DANH: Record<string, string> = {
  'TÌNH TRẠNG MĂT': 'TÌNH TRẠNG MẮT', 'NGƯỜI CẮT KINH': 'NGƯỜI CẮT KÍNH', 'ĐỊA CHỈ': 'ĐỊA CHỈ (NẾU ĐẶT SHIP)',
  // tiêu đề cũ của app (tab "Đơn kính"); "Nguồn tròng" một cột → NGUỒN KHÁC (rồi thành Nguồn tròng khi không có tick)
  'NGUỒN TRÒNG': 'NGUỒN KHÁC',
  ...Object.fromEntries(TRUONG_SUA_DUOC.filter((f) => f !== 'nguon').map((f) => [
    chuanTieuDe(NHAN[f]), COT_TONG.find((c) => c.loai === 'truong' && c.truong === f)!.tieuDe,
  ])),
};

/** Cột (theo bố cục) mà một tiêu đề trong file/Sheet ứng với; không nhận ra thì undefined. */
export function cotTheoTieuDe(tieuDe: string): CotTong | undefined {
  const k = chuanTieuDe(tieuDe);
  const chuan = BI_DANH[k] ?? k;
  return COT_TONG.find((c) => chuanTieuDe(c.tieuDe) === chuan);
}

export const laDung = (v: string) => ['TRUE', 'X', '1', 'CÓ', 'V', '✓'].includes(v.trim().toLocaleUpperCase('vi-VN'));

/** Giá trị ô của một Đơn kính ở một cột. */
export function oCua(c: CotTong, d: DonKinh): string {
  switch (c.loai) {
    case 'truong': return d[c.truong];
    case 'tick': return d.nguon === c.nguon ? 'TRUE' : 'FALSE';
    case 'nguonKhac': return d.nguon && !NGUON_TICK.includes(d.nguon) ? d.nguon : '';
    case 'thungRac': return d.thungRac ? CO : '';
    case 'id': return d.id;
  }
}

/** Một dòng theo tiêu đề thật của bảng; cột lạ giữ giá trị cũ (`cu`). */
export function hangTheoTieuDe(tieuDe: string[], d: DonKinh, cu: string[] = []): string[] {
  return tieuDe.map((td, i) => {
    const c = cotTheoTieuDe(td);
    return c ? oCua(c, d) : (cu[i] ?? '');
  });
}

/** Đọc một dòng theo tiêu đề. Ô tick: ô đầu tiên được tick là Nguồn tròng; không tick thì lấy NGUỒN KHÁC. */
export function donTuHang(tieuDe: string[], hang: string[]): DonKinh {
  const d = { id: '', thungRac: false, ...Object.fromEntries(TRUONG_SUA_DUOC.map((f) => [f, ''])) } as DonKinh;
  let tickDau = '';
  let nguonKhac = '';
  tieuDe.forEach((td, i) => {
    const c = cotTheoTieuDe(td);
    const v = (hang[i] ?? '').trim();
    if (!c) return;
    if (c.loai === 'truong') d[c.truong] = v;
    else if (c.loai === 'tick') { if (!tickDau && laDung(v)) tickDau = c.nguon; }
    else if (c.loai === 'nguonKhac') nguonKhac = v;
    else if (c.loai === 'thungRac') d.thungRac = !!v && v.toLocaleLowerCase('vi-VN') !== 'không' && v.toUpperCase() !== 'FALSE';
    else d.id = v;
  });
  // Bảng có cột tick thì nguồn lấy từ tick/NGUỒN KHÁC; bảng cũ chỉ có cột "Nguồn tròng" thì đã đọc vào nguonKhac
  d.nguon = tickDau || nguonKhac;
  return d;
}

/** Trường đồng bộ mà một cột ứng với (ô tick và NGUỒN KHÁC → nguon). */
export function truongCuaCot(c: CotTong): TruongDongBo | 'id' {
  switch (c.loai) {
    case 'truong': return c.truong;
    case 'tick': case 'nguonKhac': return 'nguon';
    case 'thungRac': return 'thungRac';
    case 'id': return 'id';
  }
}

/** Chữ cái cột A, B, …, Z, AA… (đánh số từ 0). */
export const chuCot = (i: number): string => (i < 26 ? String.fromCharCode(65 + i) : chuCot(Math.floor(i / 26) - 1) + chuCot(i % 26));

const viTri = (dk: (c: CotTong) => boolean) => COT_TONG.findIndex(dk);
const cotTruong = (f: TruongSuaDuoc) => chuCot(viTri((c) => c.loai === 'truong' && c.truong === f));

/**
 * Tab chỉ để xem, tự lọc từ TỔNG bằng công thức (không chép đơn ra chỗ khác, nên không lệch, không nhân đôi).
 * Cùng quy tắc với app: Kính hẹn = có Ngày hẹn, chưa Đã trả, không trong Thùng rác, hẹn sớm nhất lên đầu;
 * Sự cố = Phản hồi "Sự cố", không trong Thùng rác, mới đặt nhất lên đầu.
 */
export function tabXem(tabTong: string, daTra: string, suCo: string) {
  const r = (cot: string) => `'${tabTong}'!${cot}2:${cot}`;
  const rac = r(chuCot(viTri((c) => c.loai === 'thungRac')));
  const cot = (ds: TruongSuaDuoc[]) => ds.map((f) => r(cotTruong(f))).join(',');

  const henCot: TruongSuaDuoc[] = ['phanHoi', 'ngayHen', 'ngayDat', 'ten', 'tuoi', 'sdt', 'mp', 'mt', 'add', 'hang', 'loai', 'ttTrong', 'ttKinh', 'shipTime', 'diaChi', 'tuVan', 'cat', 'ghiChu'];
  const henTieuDe = henCot.map((f) => COT_TONG.find((c) => c.loai === 'truong' && c.truong === f)!.tieuDe);
  const kinhHen = `=IFERROR(SORT(FILTER({${cot(henCot)}}, ${r(cotTruong('ngayHen'))}<>"", ${r(cotTruong('ttKinh'))}<>"${daTra}", ${rac}=""), 2, TRUE), "")`;

  const suCoCot = COT_TONG.slice(0, viTri((c) => c.loai === 'nguonKhac'));
  const vung = `'${tabTong}'!A2:${chuCot(suCoCot.length - 1)}`;
  const suCoCt = `=IFERROR(SORT(FILTER(${vung}, ${r(cotTruong('phanHoi'))}="${suCo}", ${rac}=""), ${viTri((c) => c.loai === 'truong' && c.truong === 'ngayDat') + 1}, FALSE), "")`;

  return [
    { ten: 'KÍNH HẸN', tieuDe: henTieuDe, congThuc: kinhHen },
    { ten: 'SỰ CỐ', tieuDe: suCoCot.map((c) => c.tieuDe), congThuc: suCoCt },
  ];
}

export const RONG_COT = (c: CotTong) => (c.loai === 'truong' ? c.rong : undefined) ?? (c.loai === 'id' ? 38 : c.loai === 'tick' ? 10 : 12);

/**
 * Công thức viết kiểu Mỹ (dấu phẩy) → kiểu các vùng dùng dấu phẩy thập phân như Việt Nam:
 * phẩy giữa tham số thành chấm phẩy, phẩy giữa cột trong mảng {…} thành gạch chéo ngược.
 */
export function congThucChamPhay(ct: string): string {
  const ngoac: string[] = [];
  let trongChuoi = false;
  let kq = '';
  for (const k of ct) {
    if (k === '"') trongChuoi = !trongChuoi;
    if (!trongChuoi) {
      if (k === '(' || k === '{') ngoac.push(k);
      else if (k === ')' || k === '}') ngoac.pop();
      else if (k === ',') {
        kq += ngoac.at(-1) === '{' ? String.fromCharCode(92) : ';'; // 92 = gạch chéo ngược
        continue;
      }
    }
    kq += k;
  }
  return kq;
}
