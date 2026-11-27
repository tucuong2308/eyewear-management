// Lưu toàn bộ Đơn kính ra file Excel trong một thư mục (trên Máy quầy: Desktop\Sổ Đơn Kính).
// Mỗi ngày một file, ghi đè trong ngày; chỉ giữ GIU_FILE file mới nhất.
import { mkdirSync, readdirSync, renameSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import ExcelJS from 'exceljs';
import { NHAN, TRUONG_SUA_DUOC, type DonKinh } from '../core/don-kinh.js';

export const GIU_FILE = 30;
const MAU_TEN = /^So-don-kinh-\d{4}-\d{2}-\d{2}\.xlsx$/;

export const tenFileNgay = (ngay: string) => `So-don-kinh-${ngay}.xlsx`;

const RONG: Partial<Record<string, number>> = { ten: 24, sdt: 13, mp: 18, mt: 18, loai: 22, ttTrong: 18, ttKinh: 17, diaChi: 28, ghiChu: 32 };

/** Ghi file Excel của ngày `ngay` vào `thuMuc`; trả đường dẫn file. */
export async function xuatExcel(ds: DonKinh[], thuMuc: string, ngay: string): Promise<string> {
  mkdirSync(thuMuc, { recursive: true });
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Sổ Đơn Kính';
  const ws = wb.addWorksheet('Đơn kính', { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = [
    ...TRUONG_SUA_DUOC.map((f) => ({ header: NHAN[f], key: f, width: RONG[f] ?? 12, style: { numFmt: '@' } })),
    { header: 'Thùng rác', key: 'thungRac', width: 10, style: { numFmt: '@' } },
    { header: 'Mã đơn', key: 'id', width: 38, style: { numFmt: '@' } },
  ];
  ws.getRow(1).font = { bold: true };
  const sapXep = [...ds].sort((a, b) => b.ngayDat.localeCompare(a.ngayDat));
  for (const d of sapXep) ws.addRow({ ...d, thungRac: d.thungRac ? 'Có' : '' });
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: ws.columnCount } };

  // Ghi ra file tạm rồi đổi tên: nếu file đang mở trong Excel thì ghi lỗi chứ không hỏng file cũ
  const dich = join(thuMuc, tenFileNgay(ngay));
  const tam = `${dich}.tmp`;
  await wb.xlsx.writeFile(tam);
  try {
    renameSync(tam, dich);
  } catch (e) {
    rmSync(tam, { force: true });
    throw new Error(`Không ghi được ${dich} (file có đang mở trong Excel không?): ${(e as Error).message}`);
  }

  const cu = readdirSync(thuMuc).filter((f) => MAU_TEN.test(f)).sort().reverse().slice(GIU_FILE);
  for (const f of cu) rmSync(join(thuMuc, f), { force: true });
  return dich;
}
