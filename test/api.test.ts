import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startServer, type RunningServer } from '../src/server/app.js';

const HOM_NAY = '2026-11-27';

let dir: string;
let server: RunningServer;
let base: string;

async function startAt(dbPath: string) {
  server = await startServer({ dbPath, port: 0, host: '127.0.0.1', today: () => HOM_NAY });
  base = `http://127.0.0.1:${server.port}`;
}

async function api(method: string, path: string, body?: unknown) {
  const res = await fetch(base + path, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json() };
}

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'so-don-kinh-test-'));
  await startAt(join(dir, 'test.db'));
});

afterEach(async () => {
  await server.close();
  rmSync(dir, { recursive: true, force: true });
});

describe('Tạo Đơn kính', () => {
  it('tạo đơn từ tên, tên viết hoa, Ngày đặt mặc định là hôm nay', async () => {
    const r = await api('POST', '/api/don-kinh', { ten: 'nguyễn văn an' });
    expect(r.status).toBe(201);
    expect(r.body.ten).toBe('NGUYỄN VĂN AN');
    expect(r.body.ngayDat).toBe(HOM_NAY);
    expect(r.body.id).toMatch(/\S+/);
    expect(r.body.ttKinh).toBe('Chưa cắt');
    expect(r.body.ttTrong).toBe('Chưa đặt');
  });

  it('tạo đơn cho một ngày khác khi truyền Ngày đặt', async () => {
    const r = await api('POST', '/api/don-kinh', { ten: 'Lê Thu', ngayDat: '2026-11-20' });
    expect(r.body.ngayDat).toBe('2026-11-20');
  });

  it('từ chối đơn không có tên', async () => {
    const r = await api('POST', '/api/don-kinh', { ten: '   ' });
    expect(r.status).toBe(400);
  });

  it('mỗi đơn có mã riêng', async () => {
    const a = await api('POST', '/api/don-kinh', { ten: 'A' });
    const b = await api('POST', '/api/don-kinh', { ten: 'B' });
    expect(a.body.id).not.toBe(b.body.id);
  });
});

describe('Sửa một ô', () => {
  it('lưu giá trị và đọc lại được trong danh sách theo ngày', async () => {
    const { body: don } = await api('POST', '/api/don-kinh', { ten: 'Trần Bình' });
    const r = await api('PATCH', `/api/don-kinh/${don.id}`, { field: 'sdt', value: '0912345678' });
    expect(r.status).toBe(200);
    expect(r.body.sdt).toBe('0912345678');

    const list = await api('GET', `/api/don-kinh?ngayDat=${HOM_NAY}`);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].sdt).toBe('0912345678');
  });

  it('sửa tên thì tên được viết hoa', async () => {
    const { body: don } = await api('POST', '/api/don-kinh', { ten: 'x' });
    const r = await api('PATCH', `/api/don-kinh/${don.id}`, { field: 'ten', value: 'phạm hà' });
    expect(r.body.ten).toBe('PHẠM HÀ');
  });

  it('sửa Ngày đặt thì đơn chuyển sang ngày đó, vẫn chỉ một bản ghi', async () => {
    const { body: don } = await api('POST', '/api/don-kinh', { ten: 'Đỗ Chi' });
    await api('PATCH', `/api/don-kinh/${don.id}`, { field: 'ngayDat', value: '2026-11-26' });
    expect((await api('GET', `/api/don-kinh?ngayDat=${HOM_NAY}`)).body).toHaveLength(0);
    const hom_qua = await api('GET', '/api/don-kinh?ngayDat=2026-11-26');
    expect(hom_qua.body.map((d: { id: string }) => d.id)).toEqual([don.id]);
  });

  it('không cho sửa mã đơn hoặc trường không tồn tại', async () => {
    const { body: don } = await api('POST', '/api/don-kinh', { ten: 'Vũ Nam' });
    expect((await api('PATCH', `/api/don-kinh/${don.id}`, { field: 'id', value: 'khac' })).status).toBe(400);
    expect((await api('PATCH', `/api/don-kinh/${don.id}`, { field: 'khongCo', value: '1' })).status).toBe(400);
  });

  it('báo 404 khi sửa đơn không tồn tại', async () => {
    const r = await api('PATCH', '/api/don-kinh/khong-co', { field: 'sdt', value: '1' });
    expect(r.status).toBe(404);
  });
});

describe('Danh sách theo ngày', () => {
  it('chỉ trả về đơn có Ngày đặt bằng ngày được hỏi, theo thứ tự tạo', async () => {
    await api('POST', '/api/don-kinh', { ten: 'Một' });
    await api('POST', '/api/don-kinh', { ten: 'Khác ngày', ngayDat: '2026-11-01' });
    await api('POST', '/api/don-kinh', { ten: 'Hai' });
    const r = await api('GET', `/api/don-kinh?ngayDat=${HOM_NAY}`);
    expect(r.body.map((d: { ten: string }) => d.ten)).toEqual(['MỘT', 'HAI']);
  });

  it('dữ liệu còn nguyên sau khi khởi động lại exe', async () => {
    const dbPath = join(dir, 'test.db');
    await api('POST', '/api/don-kinh', { ten: 'Bền Vững' });
    await server.close();
    await startAt(dbPath);
    const r = await api('GET', `/api/don-kinh?ngayDat=${HOM_NAY}`);
    expect(r.body.map((d: { ten: string }) => d.ten)).toEqual(['BỀN VỮNG']);
  });
});
