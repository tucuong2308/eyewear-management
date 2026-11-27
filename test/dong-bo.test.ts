import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startServer, type RunningServer } from '../src/server/app.js';
import { SheetGia } from './sheet-gia.js';

const TAI_KHOAN = { ten: 'cuahang', matKhau: 'mat-khau-test' };

let dir: string;
let server: RunningServer;
let base: string;
let cookie = '';
let sheet: SheetGia;

async function startAt() {
  // chuKyDongBo: 0 → không tự chạy theo giờ; test gọi server.dongBo() khi cần
  server = await startServer({
    fileDuLieu: join(dir, 'So-don-kinh.xlsx'), port: 0, host: '127.0.0.1', today: () => '2026-11-27',
    taiKhoan: TAI_KHOAN, kenhSheet: sheet, chuKyDongBo: 0,
  });
  base = `http://127.0.0.1:${server.port}`;
  cookie = '';
  const r = await fetch(base + '/api/dang-nhap', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(TAI_KHOAN) });
  cookie = r.headers.get('set-cookie')!.split(';')[0]!;
}

async function api(method: string, path: string, body?: unknown) {
  const headers: Record<string, string> = { cookie };
  if (body) headers['content-type'] = 'application/json';
  const res = await fetch(base + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, body: await res.json() };
}

const sua = (id: string, field: string, value: string) => api('PATCH', `/api/don-kinh/${id}`, { field, value });

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'so-don-kinh-dongbo-'));
  sheet = new SheetGia();
  await startAt();
});

afterEach(async () => {
  await server.close();
  rmSync(dir, { recursive: true, force: true });
});

describe('Đồng bộ exe ↔ Google Sheet', () => {
  it('đơn tạo trên Máy quầy lên Sheet đủ các ô, mỗi đơn một dòng', async () => {
    const { body: don } = await api('POST', '/api/don-kinh', { ten: 'Lên sheet' });
    await server.dongBo();
    expect(sheet.dong.size).toBe(1);
    expect(sheet.o(don.id, 'ten')).toBe('LÊN SHEET');
    expect(sheet.o(don.id, 'ngayDat')).toBe('2026-11-27');
    expect(sheet.o(don.id, 'ttKinh')).toBe('Chưa cắt');
  });

  it('mất mạng vẫn sửa được; có mạng lại thì Sheet nhận đúng 3 ô đã sửa', async () => {
    const { body: don } = await api('POST', '/api/don-kinh', { ten: 'Mất mạng' });
    await server.dongBo();
    sheet.coMang = false;

    expect((await sua(don.id, 'sdt', '0912345678')).status).toBe(200);
    await sua(don.id, 'mp', '-1.25');
    await sua(don.id, 'mt', '-1.50');
    await server.dongBo(); // thất bại lặng lẽ
    expect(sheet.o(don.id, 'sdt')).toBe(''); // vẫn là giá trị lúc tạo đơn
    expect((await api('GET', '/api/dong-bo')).body.soChoDay).toBe(3);

    sheet.coMang = true;
    await server.dongBo();
    expect([sheet.o(don.id, 'sdt'), sheet.o(don.id, 'mp'), sheet.o(don.id, 'mt')]).toEqual(['0912345678', '-1.25', '-1.50']);
    expect((await api('GET', '/api/dong-bo')).body.soChoDay).toBe(0);
  });

  it('cùng một ô sửa ở cả hai nơi khi mất mạng: giá trị của Máy quầy thắng', async () => {
    const { body: don } = await api('POST', '/api/don-kinh', { ten: 'Trùng ô' });
    await server.dongBo();
    sheet.coMang = false;
    await sua(don.id, 'sdt', '0900000001'); // Máy quầy
    sheet.suaTrenSheet(don.id, 'sdt', '0900000002'); // bản online

    sheet.coMang = true;
    await server.dongBo();
    expect(sheet.o(don.id, 'sdt')).toBe('0900000001');
    expect((await api('GET', '/api/don-kinh?ngayDat=2026-11-27')).body[0].sdt).toBe('0900000001');
  });

  it('ô khác được sửa trên Sheet thì kéo về Máy quầy', async () => {
    const { body: don } = await api('POST', '/api/don-kinh', { ten: 'Kéo về' });
    await server.dongBo();
    sheet.coMang = false;
    await sua(don.id, 'sdt', '0911111111');
    sheet.suaTrenSheet(don.id, 'ngayHen', '2026-11-30');

    sheet.coMang = true;
    await server.dongBo();
    const local = (await api('GET', '/api/don-kinh?ngayDat=2026-11-27')).body[0];
    expect(local.sdt).toBe('0911111111');
    expect(local.ngayHen).toBe('2026-11-30');
    expect(sheet.o(don.id, 'sdt')).toBe('0911111111');
  });

  it('đơn mới tạo trên bản online (có trên Sheet) xuất hiện ở Máy quầy', async () => {
    sheet.suaTrenSheet('don-online-1', 'ten', 'TẠO Ở NHÀ');
    sheet.suaTrenSheet('don-online-1', 'ngayDat', '2026-11-27');
    sheet.suaTrenSheet('don-online-1', 'ttKinh', 'Chưa cắt');
    await server.dongBo();
    const ds = (await api('GET', '/api/don-kinh?ngayDat=2026-11-27')).body;
    expect(ds.map((d: { id: string; ten: string }) => [d.id, d.ten])).toEqual([['don-online-1', 'TẠO Ở NHÀ']]);
  });

  it('Thùng rác cũng được đồng bộ hai chiều', async () => {
    const { body: don } = await api('POST', '/api/don-kinh', { ten: 'Bỏ đi' });
    await api('POST', `/api/don-kinh/${don.id}/thung-rac`);
    await server.dongBo();
    expect(sheet.o(don.id, 'thungRac')).toBe('1');

    sheet.suaTrenSheet(don.id, 'thungRac', '');
    await server.dongBo();
    expect((await api('GET', '/api/thung-rac')).body).toEqual([]);
  });

  it('thay đổi chưa đẩy còn nguyên sau khi khởi động lại exe', async () => {
    const { body: don } = await api('POST', '/api/don-kinh', { ten: 'Tắt máy' });
    await server.dongBo();
    sheet.coMang = false;
    await sua(don.id, 'sdt', '0922222222');
    await server.close();

    await startAt();
    sheet.coMang = true;
    await server.dongBo();
    expect(sheet.o(don.id, 'sdt')).toBe('0922222222');
  });

  it('lưu nội bộ thời điểm đồng bộ thành công gần nhất', async () => {
    expect((await api('GET', '/api/dong-bo')).body.lanCuoiThanhCong).toBeNull();
    await server.dongBo();
    expect(typeof (await api('GET', '/api/dong-bo')).body.lanCuoiThanhCong).toBe('number');
  });
});

describe('Kênh Apps Script (giao kèo HTTP)', () => {
  it('đẩy và kéo qua HTTP đúng giao kèo; sai khóa thì báo lỗi', async () => {
    const { createServer } = await import('node:http');
    const { KenhAppsScript } = await import('../src/server/kenh-apps-script.js');
    const sau = new SheetGia();
    // Máy chủ giả đóng vai Web App của Apps Script
    const http = createServer(async (req, res) => {
      let s = '';
      for await (const c of req) s += c;
      const b = JSON.parse(s);
      const tra = (o: unknown) => res.end(JSON.stringify(o));
      if (b.khoa !== 'khoa-dung') return tra({ ok: false, loi: 'Sai khóa' });
      if (b.hanhDong === 'day') return tra((await sau.day(b.thayDoi), { ok: true }));
      if (b.hanhDong === 'keo') return tra({ ok: true, ...(await sau.keo(b.moc)) });
      tra({ ok: false, loi: 'Không rõ hành động' });
    });
    await new Promise<void>((r) => http.listen(0, '127.0.0.1', r));
    const url = `http://127.0.0.1:${(http.address() as { port: number }).port}`;
    try {
      const kenh = new KenhAppsScript({ url, khoa: 'khoa-dung' });
      await kenh.day([{ id: 'a', truong: 'sdt', giaTri: '0912' }]);
      expect(sau.o('a', 'sdt')).toBe('0912');
      const k = await kenh.keo(0);
      expect(k.thayDoi).toEqual([{ id: 'a', truong: 'sdt', giaTri: '0912' }]);
      expect(k.moc).toBe(1);
      await expect(new KenhAppsScript({ url, khoa: 'sai' }).keo(0)).rejects.toThrow('Sai khóa');
    } finally {
      http.close();
    }
  });
});
