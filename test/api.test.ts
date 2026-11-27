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

// Điền đủ mọi trường bắt buộc trước khi Hoàn thành (mọi trường trừ ADD, ship, ghi chú).
const DU_THONG_TIN: Record<string, string> = {
  tuoi: '30', sdt: '0912345678', mp: '-1.25', mt: '-1.50', hang: 'FANO', loai: 'FANO 1.61', nguon: 'Kính sẵn',
  ttTrong: 'Đã có', tuVan: 'Lan', cat: 'Minh', phanHoi: 'Tốt',
};

async function taoDonHen(ten: string, ngayHen: string, duThongTin = true) {
  const { body: don } = await api('POST', '/api/don-kinh', { ten, ngayDat: '2026-11-20' });
  const truong = { ...(duThongTin ? DU_THONG_TIN : {}), ngayHen };
  let kq = don;
  for (const [field, value] of Object.entries(truong)) {
    kq = (await api('PATCH', `/api/don-kinh/${don.id}`, { field, value })).body;
  }
  return kq;
}

describe('Đến hẹn và quá hẹn', () => {
  it('gồm Kính hẹn có Ngày hẹn hôm nay hoặc đã qua, gần hôm nay nhất lên trước', async () => {
    await taoDonHen('Quá ba ngày', '2026-11-24');
    await taoDonHen('Hôm nay', HOM_NAY);
    await taoDonHen('Ngày mai', '2026-11-28');
    await taoDonHen('Quá một ngày', '2026-11-26');
    await api('POST', '/api/don-kinh', { ten: 'Không hẹn' });

    const r = await api('GET', '/api/den-hen');
    expect(r.status).toBe(200);
    expect(r.body.map((d: { ten: string }) => d.ten)).toEqual(['HÔM NAY', 'QUÁ MỘT NGÀY', 'QUÁ BA NGÀY']);
  });

  it('không gồm đơn đã Hoàn thành', async () => {
    const don = await taoDonHen('Đã trả rồi', '2026-11-25');
    await api('PATCH', `/api/don-kinh/${don.id}`, { field: 'ttKinh', value: 'Đã trả' });
    expect((await api('GET', '/api/den-hen')).body).toEqual([]);
  });
});

describe('Hoàn thành', () => {
  it('bị chặn khi thiếu trường bắt buộc và trả về đúng các trường còn thiếu', async () => {
    const don = await taoDonHen('Thiếu nhiều', HOM_NAY, false);
    const r = await api('POST', `/api/don-kinh/${don.id}/hoan-thanh`);
    expect(r.status).toBe(422);
    // Tình trạng tròng có giá trị mặc định "Chưa đặt" nên không bị tính là thiếu
    expect(r.body.thieu).toEqual(['tuoi', 'sdt', 'mp', 'mt', 'hang', 'loai', 'nguon', 'tuVan', 'cat', 'phanHoi']);
    expect(r.body.loi).toContain('SĐT');
  });

  it('không bắt buộc ADD, thời gian ship, địa chỉ ship, ghi chú', async () => {
    const don = await taoDonHen('Đủ thông tin', HOM_NAY);
    const r = await api('POST', `/api/don-kinh/${don.id}/hoan-thanh`);
    expect(r.status).toBe(200);
    expect(r.body.add).toBe('');
    expect(r.body.ghiChu).toBe('');
  });

  it('thành công thì Tình trạng kính = Đã trả và đơn rời khỏi Đến hẹn', async () => {
    const don = await taoDonHen('Trả kính', '2026-11-26');
    const r = await api('POST', `/api/don-kinh/${don.id}/hoan-thanh`);
    expect(r.body.ttKinh).toBe('Đã trả');
    expect((await api('GET', '/api/den-hen')).body).toEqual([]);
  });

  it('Hoàn tác bằng cách đặt lại Tình trạng kính cũ thì đơn quay lại Đến hẹn', async () => {
    const don = await taoDonHen('Bấm nhầm', HOM_NAY);
    await api('POST', `/api/don-kinh/${don.id}/hoan-thanh`);
    await api('PATCH', `/api/don-kinh/${don.id}`, { field: 'ttKinh', value: don.ttKinh });
    expect((await api('GET', '/api/den-hen')).body.map((d: { id: string }) => d.id)).toEqual([don.id]);
  });

  it('báo 404 với đơn không tồn tại', async () => {
    expect((await api('POST', '/api/don-kinh/khong-co/hoan-thanh')).status).toBe(404);
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
