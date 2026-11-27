import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ExcelJS from 'exceljs';
import { startServer, type RunningServer } from '../src/server/app.js';

const TK = { ten: 'cuahang', matKhau: 'mk' };
let dir: string;
let thuMuc: string;
let server: RunningServer;
let base: string;
let cookie = '';

async function api(method: string, path: string, body?: unknown) {
  const res = await fetch(base + path, {
    method, headers: { cookie, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json() };
}

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'so-don-kinh-excel-'));
  thuMuc = join(dir, 'Desktop', 'Sổ Đơn Kính');
  server = await startServer({
    dbPath: join(dir, 't.db'), port: 0, host: '127.0.0.1', today: () => '2026-11-27', taiKhoan: TK,
    thuMucExcel: thuMuc, chuKyExcel: 0,
  });
  base = `http://127.0.0.1:${server.port}`;
  const r = await fetch(base + '/api/dang-nhap', { method: 'POST', body: JSON.stringify(TK), headers: { 'content-type': 'application/json' } });
  cookie = r.headers.get('set-cookie')!.split(';')[0]!;
});

afterEach(async () => {
  await server.close();
  rmSync(dir, { recursive: true, force: true });
});

describe('Xuất Excel', () => {
  it('lưu file của hôm nay vào thư mục, tiêu đề tiếng Việt, mỗi đơn một dòng, giữ ô dạng chữ', async () => {
    const { body: a } = await api('POST', '/api/don-kinh', { ten: 'Excel Một' });
    await api('PATCH', `/api/don-kinh/${a.id}`, { field: 'sdt', value: '0912345678' });
    await api('PATCH', `/api/don-kinh/${a.id}`, { field: 'ngayHen', value: '2026-11-30' });
    const { body: b } = await api('POST', '/api/don-kinh', { ten: 'Excel Hai' });
    await api('POST', `/api/don-kinh/${b.id}/thung-rac`);

    const r = await api('POST', '/api/xuat-excel');
    expect(r.status).toBe(200);
    expect(r.body.duongDan).toBe(join(thuMuc, 'So-don-kinh-2026-11-27.xlsx'));

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(r.body.duongDan);
    const ws = wb.getWorksheet('Đơn kính')!;
    const tieuDe = (ws.getRow(1).values as string[]).slice(1);
    expect(tieuDe.slice(0, 4)).toEqual(['Tên', 'Tuổi', 'SĐT', 'MP']);
    expect(tieuDe).toContain('Thùng rác');
    expect(ws.rowCount).toBe(3);
    const hang = new Map<string, Record<string, unknown>>();
    for (let i = 2; i <= 3; i++) {
      const v = ws.getRow(i).values as unknown[];
      hang.set(String(v[1]), Object.fromEntries(tieuDe.map((t, j) => [t, v[j + 1]])));
    }
    expect(hang.get('EXCEL MỘT')).toMatchObject({ 'SĐT': '0912345678', 'Ngày hẹn': '2026-11-30', 'Thùng rác': '' });
    expect(hang.get('EXCEL HAI')!['Thùng rác']).toBe('Có');
  });

  it('chỉ giữ 30 file mới nhất, không đụng file khác trong thư mục', async () => {
    mkdirSync(thuMuc, { recursive: true });
    for (let d = 1; d <= 31; d++) writeFileSync(join(thuMuc, `So-don-kinh-2026-10-${String(d).padStart(2, '0')}.xlsx`), 'cu');
    writeFileSync(join(thuMuc, 'ghi-chu-cua-toi.txt'), 'giữ lại');
    await api('POST', '/api/xuat-excel');
    const tep = readdirSync(thuMuc).filter((f) => f.endsWith('.xlsx')).sort();
    expect(tep).toHaveLength(30);
    expect(tep.at(-1)).toBe('So-don-kinh-2026-11-27.xlsx');
    expect(tep[0]).toBe('So-don-kinh-2026-10-03.xlsx');
    expect(existsSync(join(thuMuc, 'ghi-chu-cua-toi.txt'))).toBe(true);
  });
});
