// Chuyển Đơn kính tháng 11/2026 từ file Excel (tải về từ Google Sheets cũ) vào dữ liệu của Máy quầy.
// Các đơn được ghi "chờ đẩy" nên tự lên Google Sheet mới khi đồng bộ được bật.
//
//   npm run nhap-thang-11 -- <file.xlsx> [--data <thư mục dữ liệu>] [--thu]
//
//   --data  thư mục chứa so-don-kinh.db (mặc định: ./data; exe dùng %LOCALAPPDATA%\SoDonKinh)
//   --thu   chỉ đọc và báo cáo, không ghi gì
//
// Dữ liệu Bệnh nhân thật: chỉ xử lý trên máy, không commit file Excel hay CSDL. Báo cáo chỉ in số đếm.
import { createHash } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import ExcelJS from 'exceljs';
import { chuyenDong, type GiaTriO } from '../src/core/nhap-thang-11.js';
import { KhoDonKinh } from '../src/server/kho.js';

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--') && args[args.indexOf(a) - 1] !== '--data');
const dataDir = resolve(args.includes('--data') ? args[args.indexOf('--data') + 1]! : join(process.cwd(), 'data'));
const chiThu = args.includes('--thu');
if (!file) {
  console.error('Cách dùng: npx tsx scripts/nhap-thang-11.ts <file.xlsx> [--data <thư mục>] [--thu]');
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

mkdirSync(dataDir, { recursive: true });
const kho = chiThu ? null : new KhoDonKinh(join(dataDir, 'so-don-kinh.db'));
const dem = { dong: 0, moi: 0, daCo: 0 };
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
  if (kho) (kho.nhapDon(kq.don) ? dem.moi++ : dem.daCo++);
});
if (kho) {
  for (const n of nhanVien) kho.themVaoDanhSach('nhanVien', n);
  kho.dong();
}

console.log(`Đọc ${dem.dong} Đơn kính từ sheet TỔNG.`);
if (chiThu) console.log('Chạy thử (--thu): chưa ghi gì.');
else console.log(`Nhập mới ${dem.moi}, bỏ qua ${dem.daCo} đơn đã có. Thêm ${nhanVien.size} tên vào danh sách Nhân viên.`);
for (const [loai, n] of canhBao) console.log(`  Cần kiểm tra: ${loai} (${n} đơn)`);
console.log('Đơn có nguồn tròng không rõ được ghi "[KIỂM TRA NGUỒN TRÒNG]" ở đầu Ghi chú; tìm ở trang Tổng.');
