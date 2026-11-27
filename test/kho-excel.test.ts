import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, renameSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ExcelJS from 'exceljs';
import { KhoExcel, LoiFileDangMo, TAB_FILE } from '../src/server/kho-excel.js';

let dir: string;
let file: string;
let dangMo = false;
let kho: KhoExcel;

/** Giả lập Excel đang mở file: Windows từ chối đổi tên đè lên file đang mở. */
const doiTen = (tu: string, den: string) => {
  if (dangMo) throw Object.assign(new Error('EBUSY: resource busy or locked'), { code: 'EBUSY' });
  renameSync(tu, den);
};

const moKho = () => KhoExcel.mo(file, { doiTen });

/** Sửa file như nhân viên sửa trong Excel rồi bấm Lưu. */
async function suaTrongExcel(sua: (ws: ExcelJS.Worksheet) => void) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  sua(wb.getWorksheet(TAB_FILE.don)!);
  await wb.xlsx.writeFile(file);
  const sau = new Date(Date.now() + 5_000);
  utimesSync(file, sau, sau);
}

async function docTab(ten: string) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  const ws = wb.getWorksheet(ten)!;
  const hang: string[][] = [];
  ws.eachRow((r) => hang.push((r.values as unknown[]).slice(1).map((v) => (v == null ? '' : String(v)))));
  return { ws, hang };
}

const cot = (hang: string[][], tieuDe: string) => hang[0]!.indexOf(tieuDe);

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'so-don-kinh-kho-'));
  file = join(dir, 'Sổ Đơn Kính', 'So-don-kinh.xlsx');
  dangMo = false;
  kho = await moKho();
});

afterEach(async () => {
  await kho.dong();
  rmSync(dir, { recursive: true, force: true });
});

describe('Kho Excel: file là dữ liệu chính', () => {
  it('lần đầu tạo file có tab Đơn kính, Danh sách và các tab ẩn', async () => {
    expect(existsSync(file)).toBe(true);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(file);
    expect(wb.worksheets.map((w) => [w.name, w.state])).toEqual([
      [TAB_FILE.don, 'visible'], [TAB_FILE.danhSach, 'visible'],
      [TAB_FILE.choDay, 'veryHidden'], [TAB_FILE.trangThai, 'veryHidden'], [TAB_FILE.phien, 'veryHidden'],
    ]);
    expect(kho.danhSach().hang).toContain('ESSILOR');
  });

  it('mỗi thay đổi ghi vào file, giữ ô dạng chữ; mở lại thấy nguyên dữ liệu, hàng chờ và trạng thái', async () => {
    const a = await kho.tao('AN', '2026-11-27');
    await kho.sua(a.id, 'sdt', '0912345678');
    await kho.datTrangThai('mocKeo', '7');
    await kho.taoPhien('bam-1', 9e15);

    const { ws, hang } = await docTab(TAB_FILE.don);
    expect(hang).toHaveLength(2);
    expect(hang[1]![cot(hang, 'SĐT')]).toBe('0912345678');
    expect(hang[1]![cot(hang, 'Mã đơn')]).toBe(a.id);
    expect(ws.getRow(2).getCell(cot(hang, 'SĐT') + 1).numFmt).toBe('@');

    await kho.dong();
    kho = await moKho();
    expect(kho.lay(a.id)?.sdt).toBe('0912345678');
    expect(kho.choDay().find((o) => o.truong === 'sdt')?.giaTri).toBe('0912345678');
    expect(kho.trangThai('mocKeo')).toBe('7');
    expect(kho.phienConHan('bam-1', Date.now())).toBe(true);
  });

  it('ghi tuần tự: nhiều thay đổi cùng lúc đều vào file', async () => {
    const a = await kho.tao('AN', '2026-11-27');
    await Promise.all(['tuoi', 'sdt', 'mp', 'mt', 'hang', 'ghiChu'].map((f, i) => kho.sua(a.id, f as 'tuoi', String(i))));
    await kho.dong();
    kho = await moKho();
    const d = kho.lay(a.id)!;
    expect([d.tuoi, d.sdt, d.mp, d.mt, d.hang, d.ghiChu]).toEqual(['0', '1', '2', '3', '4', '5']);
  });
});

describe('Kho Excel: file đang mở trong Excel', () => {
  it('báo lỗi "đóng Excel rồi thử lại", không đổi dữ liệu trong bộ nhớ lẫn file', async () => {
    const a = await kho.tao('AN', '2026-11-27');
    dangMo = true;
    await expect(kho.sua(a.id, 'sdt', '0999')).rejects.toBeInstanceOf(LoiFileDangMo);
    await expect(kho.tao('BÌNH', '2026-11-27')).rejects.toThrow(/đóng Excel rồi thử lại/i);
    expect(kho.lay(a.id)?.sdt).toBe('');
    expect(kho.tatCa()).toHaveLength(1);
    expect(kho.choDay().some((o) => o.giaTri === '0999')).toBe(false);
    expect(readdirSync(join(dir, 'Sổ Đơn Kính'))).toEqual(['So-don-kinh.xlsx']);

    dangMo = false;
    await kho.sua(a.id, 'sdt', '0999');
    expect(kho.lay(a.id)?.sdt).toBe('0999');
  });

  it('đăng nhập vẫn được khi file đang mở (phiên ghi sau)', async () => {
    dangMo = true;
    await kho.taoPhien('bam-2', 9e15);
    expect(kho.phienConHan('bam-2', Date.now())).toBe(true);
  });
});

describe('Kho Excel: sửa tay trong Excel', () => {
  it('sửa ô rồi Lưu: app đọc lại, ô đổi vào hàng chờ đồng bộ; ngày gõ kiểu Excel được chuẩn hóa', async () => {
    const a = await kho.tao('AN', '2026-11-27');
    await kho.xoaChoDay(kho.choDay());
    const { hang } = await docTab(TAB_FILE.don);
    await suaTrongExcel((ws) => {
      ws.getRow(2).getCell(cot(hang, 'SĐT') + 1).value = '0911222333';
      ws.getRow(2).getCell(cot(hang, 'Ngày hẹn') + 1).value = new Date(Date.UTC(2026, 10, 30));
    });

    await kho.docLaiNeuDoi();
    expect(kho.lay(a.id)).toMatchObject({ sdt: '0911222333', ngayHen: '2026-11-30' });
    expect(kho.choDay().map(({ truong, giaTri }) => [truong, giaTri])).toEqual([['sdt', '0911222333'], ['ngayHen', '2026-11-30']]);
  });

  it('dòng mới không có Mã đơn được cấp mã và ghi mã vào file', async () => {
    await kho.tao('AN', '2026-11-27');
    const { hang } = await docTab(TAB_FILE.don);
    await suaTrongExcel((ws) => {
      const r = ws.getRow(3);
      r.getCell(cot(hang, 'Tên') + 1).value = 'BÌNH';
      r.getCell(cot(hang, 'Ngày đặt') + 1).value = '2026-11-26';
    });

    await kho.docLaiNeuDoi();
    const binh = kho.tatCa().find((d) => d.ten === 'BÌNH')!;
    expect(binh.id).toMatch(/[0-9a-f-]{36}/);
    expect(kho.choDay().filter((o) => o.id === binh.id).map((o) => o.truong)).toEqual(expect.arrayContaining(['ten', 'ngayDat']));
    const sau = await docTab(TAB_FILE.don);
    expect(sau.hang[2]![cot(sau.hang, 'Mã đơn')]).toBe(binh.id);
  });

  it('file vẫn mở sau khi Lưu: dòng mới giữ đúng một mã qua nhiều lần Lưu, ghi mã khi đóng Excel', async () => {
    const { hang } = await docTab(TAB_FILE.don);
    dangMo = true;
    await suaTrongExcel((ws) => { ws.getRow(2).getCell(cot(hang, 'Tên') + 1).value = 'CHI'; });
    await kho.docLaiNeuDoi();
    const id = kho.tatCa()[0]!.id;
    await suaTrongExcel((ws) => { ws.getRow(2).getCell(cot(hang, 'SĐT') + 1).value = '0123'; });
    await kho.docLaiNeuDoi();
    expect(kho.tatCa()).toHaveLength(1);
    expect(kho.tatCa()[0]).toMatchObject({ id, ten: 'CHI', sdt: '0123' });

    dangMo = false;
    await kho.sua(id, 'tuoi', '40');
    const sau = await docTab(TAB_FILE.don);
    expect(sau.hang[1]![cot(sau.hang, 'Mã đơn')]).toBe(id);
  });

  it('xóa hẳn một dòng trong Excel thì đơn vào Thùng rác, không mất', async () => {
    const a = await kho.tao('AN', '2026-11-27');
    await kho.tao('BÌNH', '2026-11-27');
    await suaTrongExcel((ws) => ws.spliceRows(2, 1));
    await kho.docLaiNeuDoi();
    expect(kho.lay(a.id)).toMatchObject({ ten: 'AN', thungRac: true });
    expect(kho.choDay().find((o) => o.id === a.id && o.truong === 'thungRac')?.giaTri).toBe('1');
    const sau = await docTab(TAB_FILE.don);
    expect(sau.hang.map((h) => h[cot(sau.hang, 'Tên')])).toEqual(['Tên', 'BÌNH', 'AN']);
  });

  it('sửa Danh sách trong Excel thì app dùng danh sách mới', async () => {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(file);
    const ws = wb.getWorksheet(TAB_FILE.danhSach)!;
    const c = (ws.getRow(1).values as string[]).indexOf('Hãng');
    ws.getCell(20, c).value = 'HÃNG MỚI';
    await wb.xlsx.writeFile(file);
    const sau = new Date(Date.now() + 5_000);
    utimesSync(file, sau, sau);
    await kho.docLaiNeuDoi();
    expect(kho.danhSach().hang).toContain('HÃNG MỚI');
  });

  it('file bị xóa mất thì ghi lại từ bộ nhớ', async () => {
    const a = await kho.tao('AN', '2026-11-27');
    rmSync(file);
    await kho.docLaiNeuDoi();
    expect(existsSync(file)).toBe(true);
    await kho.dong();
    kho = await moKho();
    expect(kho.lay(a.id)?.ten).toBe('AN');
  });
});

describe('Kho Excel: sao lưu hằng ngày', () => {
  it('chép file vào thư mục Sao lưu theo ngày, giữ 30 bản mới nhất', async () => {
    const saoLuu = join(dir, 'Sổ Đơn Kính', 'Sao lưu');
    mkdirSync(saoLuu, { recursive: true });
    for (let i = 1; i <= 31; i++) writeFileSync(join(saoLuu, `So-don-kinh-2026-10-${String(i).padStart(2, '0')}.xlsx`), 'cũ');
    writeFileSync(join(saoLuu, 'ghi-chu.txt'), 'không đụng');
    await kho.tao('AN', '2026-11-27');

    const duongDan = await kho.saoLuu(saoLuu, '2026-11-27');
    expect(duongDan).toBe(join(saoLuu, 'So-don-kinh-2026-11-27.xlsx'));
    const tep = readdirSync(saoLuu);
    expect(tep).toHaveLength(31);
    expect(tep).toContain('ghi-chu.txt');
    expect(tep).not.toContain('So-don-kinh-2026-10-01.xlsx');
    expect(tep).not.toContain('So-don-kinh-2026-10-02.xlsx');
  });
});
