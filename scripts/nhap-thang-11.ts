// Chuyển Đơn kính tháng 11/2026 từ file Excel (tải về từ Google Sheets cũ) vào file dữ liệu của Máy quầy
// (ADR 0004: Desktop\Sổ Đơn Kính\So-don-kinh.xlsx). Các đơn được ghi "chờ đẩy" nên tự lên Google Sheet mới.
//
//   npm run nhap-thang-11 -- <file.xlsx> [--file <So-don-kinh.xlsx>] [--thu]
//
//   --file  file dữ liệu để nhập vào (mặc định: Desktop\Sổ Đơn Kính\So-don-kinh.xlsx). Đóng Excel trước khi chạy.
//   --thu   chỉ đọc và báo cáo, không ghi gì
//
// Dữ liệu Bệnh nhân thật: chỉ xử lý trên máy, không commit file Excel hay CSDL. Báo cáo chỉ in số đếm.
import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';
import ExcelJS from 'exceljs';
import { chuyenDong, type GiaTriO } from '../src/core/nhap-thang-11.js';
import type { DonKinh } from '../src/core/don-kinh.js';
import { KhoExcel } from '../src/server/kho-excel.js';
import { thuMucDesktop } from '../src/server/cau-hinh.js';

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--') && args[args.indexOf(a) - 1] !== '--file');
const fileDuLieu = resolve(args.includes('--file') ? args[args.indexOf('--file') + 1]! : join(thuMucDesktop(), 'Sổ Đơn Kính', 'So-don-kinh.xlsx'));
const chiThu = args.includes('--thu');
if (!file) {
  console.error('Cách dùng: npm run nhap-thang-11 -- <file.xlsx> [--file <So-don-kinh.xlsx>] [--thu]');
  process.exit(1);
}

/** Giá trị ô của exceljs → giá trị đơn giản. */
function giaTri(v: ExcelJS.CellValue): GiaTriO {
  if (v === null || v === undefined) return null;
  if (v instanceof Date || typeof v !== 'object') return v as GiaTriO;
  if ('richText' in v) return v.richText.map((t) => t.text).join('');
  if ('result' in v) return giaTri(v.result as ExcelJS.CellValue);
  if ('text' in v) return String(v.text);
  return null;
}

const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(file);

// Mã đơn → Ngày đặt theo sheet ngày (dùng khi ô Ngày đặt ở TỔNG trống). Sheet ngày có ngày ở ô E1, mã ở cột W.
const p2 = (n: number) => String(n).padStart(2, '0');
const ngayTheoMa = new Map<string, string>();
for (const ws of wb.worksheets) {
  if (!/^\d{2}\/?\d{2}$/.test(ws.name)) continue;
  const e1 = giaTri(ws.getCell('E1').value);
  if (!(e1 instanceof Date)) continue;
  const ngay = `${e1.getUTCFullYear()}-${p2(e1.getUTCMonth() + 1)}-${p2(e1.getUTCDate())}`;
  ws.eachRow((row, i) => {
    const ma = giaTri(row.getCell(23).value);
    if (i >= 4 && ma) ngayTheoMa.set(String(ma), ngay);
  });
}

const tong = wb.getWorksheet('TỔNG');
if (!tong) {
  console.error('Không thấy sheet "TỔNG" trong file.');
  process.exit(1);
}

const dem = { dong: 0, moi: 0, daCo: 0 };
const donNhap: DonKinh[] = [];
const canhBao = new Map<string, number>();
const nhanVien = new Set<string>();

tong.eachRow((row, i) => {
  if (i === 1) return;
  const o: GiaTriO[] = [];
  for (let c = 1; c <= 24; c++) o.push(giaTri(row.getCell(c).value));
  const ma = o[22] ? String(o[22]) : '';
  // Dòng không có mã cũ: mã tính cố định từ nội dung dòng, để chạy lại không nhập trùng
  const maTuNoiDung = () => 'nhap11-' + createHash('sha256').update(JSON.stringify(o.slice(0, 22))).digest('hex').slice(0, 16);
  const kq = chuyenDong(o, ngayTheoMa.get(ma) ?? '', maTuNoiDung);
  if (!kq) return;
  dem.dong++;
  kq.nhanVien.forEach((n) => nhanVien.add(n));
  for (const c of kq.canhBao) {
    const loai = c.replace(/:.*/, '');
    canhBao.set(loai, (canhBao.get(loai) ?? 0) + 1);
  }
  donNhap.push(kq.don);
});
if (!chiThu) {
  const kho = await KhoExcel.mo(fileDuLieu);
  Object.assign(dem, await kho.nhapNhieu(donNhap));
  for (const n of nhanVien) await kho.themVaoDanhSach('nhanVien', n);
  await kho.dong();
}

console.log(`Đọc ${dem.dong} Đơn kính từ sheet TỔNG.`);
if (chiThu) console.log('Chạy thử (--thu): chưa ghi gì.');
else console.log(`Nhập vào ${fileDuLieu}: mới ${dem.moi}, bỏ qua ${dem.daCo} đơn đã có. Thêm ${nhanVien.size} tên vào danh sách Nhân viên.`);
for (const [loai, n] of canhBao) console.log(`  Cần kiểm tra: ${loai} (${n} đơn)`);
console.log('Đơn có nguồn tròng không rõ được ghi "[KIỂM TRA NGUỒN TRÒNG]" ở đầu Ghi chú; tìm ở trang Tổng.');
