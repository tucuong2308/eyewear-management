import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startServer, type RunningServer } from '../src/server/app.js';

const HOM_NAY = '2026-11-27';
const TAI_KHOAN = { ten: 'cuahang', matKhau: 'mat-khau-test' };

let dir: string;
let server: RunningServer;
let base: string;
let cookie = '';
let bayGio = Date.parse('2026-11-27T09:00:00');

async function startAt(dbPath: string) {
  server = await startServer({
    dbPath, port: 0, host: '127.0.0.1', today: () => HOM_NAY, taiKhoan: TAI_KHOAN, bayGio: () => bayGio,
    diaChiMang: () => ['192.168.1.20'],
  });
  base = `http://127.0.0.1:${server.port}`;
}

async function api(method: string, path: string, body?: unknown) {
  const headers: Record<string, string> = {};
  if (body) headers['content-type'] = 'application/json';
  if (cookie) headers.cookie = cookie;
  const res = await fetch(base + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) cookie = setCookie.split(';')[0]!.endsWith('=') ? '' : setCookie.split(';')[0]!;
  return { status: res.status, body: await res.json() };
}

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'so-don-kinh-test-'));
  bayGio = Date.parse('2026-11-27T09:00:00');
  cookie = '';
  await startAt(join(dir, 'test.db'));
  expect((await api('POST', '/api/dang-nhap', TAI_KHOAN)).status).toBe(200);
});

afterEach(async () => {
  await server.close();
  rmSync(dir, { recursive: true, force: true });
});

describe('Đăng nhập', () => {
  it('chưa đăng nhập thì mọi API bị chặn', async () => {
    cookie = '';
    for (const [m, p] of [['GET', '/api/don-kinh'], ['POST', '/api/don-kinh'], ['GET', '/api/kinh-hen'], ['GET', '/api/danh-sach']]) {
      expect((await api(m!, p!, m === 'POST' ? { ten: 'x' } : undefined)).status, p).toBe(401);
    }
  });

  it('sai mật khẩu hoặc sai tên đăng nhập thì báo lỗi, không cấp phiên', async () => {
    cookie = '';
    const r = await api('POST', '/api/dang-nhap', { ten: 'cuahang', matKhau: 'sai' });
    expect(r.status).toBe(401);
    expect(r.body.loi).toMatch(/mật khẩu/i);
    expect((await api('POST', '/api/dang-nhap', { ten: 'khac', matKhau: TAI_KHOAN.matKhau })).status).toBe(401);
    expect((await api('GET', '/api/don-kinh')).status).toBe(401);
  });

  it('phiên còn hạn được chấp nhận, kể cả sau khi khởi động lại exe', async () => {
    bayGio += 29 * 864e5;
    await server.close();
    await startAt(join(dir, 'test.db'));
    expect((await api('GET', '/api/phien')).body).toEqual({ ten: 'cuahang' });
    expect((await api('GET', '/api/don-kinh')).status).toBe(200);
  });

  it('phiên quá 30 ngày thì phải đăng nhập lại', async () => {
    bayGio += 31 * 864e5;
    expect((await api('GET', '/api/don-kinh')).status).toBe(401);
  });

  it('đăng xuất thì phiên hết hiệu lực', async () => {
    const truoc = cookie;
    expect((await api('POST', '/api/dang-xuat')).status).toBe(200);
    cookie = truoc; // dù còn giữ cookie cũ
    expect((await api('GET', '/api/don-kinh')).status).toBe(401);
  });
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
    // Tình trạng tròng và Tình trạng kính có giá trị mặc định nên không bị tính là thiếu
    expect(r.body.thieu).toEqual(['tuoi', 'sdt', 'mp', 'mt', 'hang', 'loai', 'nguon']);
    expect(r.body.loi).toContain('SĐT');
  });

  it('Tình trạng kính để trống cũng bị chặn', async () => {
    const don = await taoDonHen('Xóa tình trạng', HOM_NAY);
    await api('PATCH', `/api/don-kinh/${don.id}`, { field: 'ttKinh', value: '' });
    const r = await api('POST', `/api/don-kinh/${don.id}/hoan-thanh`);
    expect(r.status).toBe(422);
    expect(r.body.thieu).toEqual(['ttKinh']);
  });

  it('không bắt buộc Người tư vấn, Người cắt, Phản hồi', async () => {
    const don = await taoDonHen('Chưa ghi người', HOM_NAY);
    for (const field of ['tuVan', 'cat', 'phanHoi']) await api('PATCH', `/api/don-kinh/${don.id}`, { field, value: '' });
    expect((await api('POST', `/api/don-kinh/${don.id}/hoan-thanh`)).status).toBe(200);
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

describe('Trang Kính hẹn', () => {
  it('gồm mọi đơn có Ngày hẹn chưa Hoàn thành, hẹn sớm nhất lên đầu', async () => {
    await taoDonHen('Tuần sau', '2026-12-04');
    await taoDonHen('Quá hẹn', '2026-11-25');
    await taoDonHen('Ngày mai', '2026-11-28');
    const xong = await taoDonHen('Đã trả', '2026-11-26');
    await api('POST', `/api/don-kinh/${xong.id}/hoan-thanh`);
    await api('POST', '/api/don-kinh', { ten: 'Không hẹn' });

    const r = await api('GET', '/api/kinh-hen');
    expect(r.status).toBe(200);
    expect(r.body.map((d: { ten: string }) => d.ten)).toEqual(['QUÁ HẸN', 'NGÀY MAI', 'TUẦN SAU']);
  });

  it('nhập Ngày hẹn ở bất kỳ đâu thì đơn xuất hiện ở Kính hẹn, xóa Ngày hẹn thì rời đi', async () => {
    const { body: don } = await api('POST', '/api/don-kinh', { ten: 'Mới hẹn' });
    await api('PATCH', `/api/don-kinh/${don.id}`, { field: 'ngayHen', value: '2026-11-30' });
    expect((await api('GET', '/api/kinh-hen')).body.map((d: { id: string }) => d.id)).toEqual([don.id]);
    await api('PATCH', `/api/don-kinh/${don.id}`, { field: 'ngayHen', value: '' });
    expect((await api('GET', '/api/kinh-hen')).body).toEqual([]);
  });
});

describe('Sự cố', () => {
  it('đơn có Phản hồi = Sự cố hiện ở trang Sự cố, đổi khỏi Sự cố thì rời đi', async () => {
    const { body: don } = await api('POST', '/api/don-kinh', { ten: 'Cắt sai độ' });
    await api('POST', '/api/don-kinh', { ten: 'Bình thường' });
    await api('PATCH', `/api/don-kinh/${don.id}`, { field: 'phanHoi', value: 'Sự cố' });
    expect((await api('GET', '/api/su-co')).body.map((d: { id: string }) => d.id)).toEqual([don.id]);

    await api('PATCH', `/api/don-kinh/${don.id}`, { field: 'phanHoi', value: 'Tốt' });
    expect((await api('GET', '/api/su-co')).body).toEqual([]);
  });

  it('đơn Sự cố chưa Hoàn thành vẫn ở Kính hẹn', async () => {
    const don = await taoDonHen('Sự cố chưa trả', '2026-11-30');
    await api('PATCH', `/api/don-kinh/${don.id}`, { field: 'phanHoi', value: 'Sự cố' });
    expect((await api('GET', '/api/kinh-hen')).body.map((d: { id: string }) => d.id)).toEqual([don.id]);
    expect((await api('GET', '/api/su-co')).body.map((d: { id: string }) => d.id)).toEqual([don.id]);
  });

  it('bỏ chọn Phản hồi (để trống) được', async () => {
    const { body: don } = await api('POST', '/api/don-kinh', { ten: 'Bấm nhầm' });
    await api('PATCH', `/api/don-kinh/${don.id}`, { field: 'phanHoi', value: 'Sự cố' });
    const r = await api('PATCH', `/api/don-kinh/${don.id}`, { field: 'phanHoi', value: '' });
    expect(r.body.phanHoi).toBe('');
    expect((await api('GET', '/api/su-co')).body).toEqual([]);
  });
});

describe('Thùng rác', () => {
  it('đơn trong Thùng rác không xuất hiện ở Hôm nay, Kính hẹn, Đến hẹn, Sự cố', async () => {
    const don = await taoDonHen('Nhập trùng', HOM_NAY);
    await api('PATCH', `/api/don-kinh/${don.id}`, { field: 'ngayDat', value: HOM_NAY });
    await api('PATCH', `/api/don-kinh/${don.id}`, { field: 'phanHoi', value: 'Sự cố' });

    const r = await api('POST', `/api/don-kinh/${don.id}/thung-rac`);
    expect(r.status).toBe(200);
    expect(r.body.thungRac).toBe(true);
    for (const path of [`/api/don-kinh?ngayDat=${HOM_NAY}`, '/api/kinh-hen', '/api/den-hen', '/api/su-co']) {
      expect((await api('GET', path)).body, path).toEqual([]);
    }
    expect((await api('GET', '/api/thung-rac')).body.map((d: { id: string }) => d.id)).toEqual([don.id]);
  });

  it('khôi phục thì đơn quay lại mọi trang, không mất dữ liệu', async () => {
    const don = await taoDonHen('Bỏ nhầm', HOM_NAY);
    await api('POST', `/api/don-kinh/${don.id}/thung-rac`);
    const r = await api('POST', `/api/don-kinh/${don.id}/khoi-phuc`);
    expect(r.body.thungRac).toBe(false);
    expect(r.body.sdt).toBe(DU_THONG_TIN.sdt);
    expect((await api('GET', '/api/den-hen')).body.map((d: { id: string }) => d.id)).toEqual([don.id]);
    expect((await api('GET', '/api/thung-rac')).body).toEqual([]);
  });

  it('đơn mới không nằm trong Thùng rác; báo 404 với đơn không tồn tại', async () => {
    const { body } = await api('POST', '/api/don-kinh', { ten: 'Mới' });
    expect(body.thungRac).toBe(false);
    expect((await api('POST', '/api/don-kinh/khong-co/thung-rac')).status).toBe(404);
    expect((await api('POST', '/api/don-kinh/khong-co/khoi-phuc')).status).toBe(404);
  });
});

describe('Lịch sử', () => {
  it('đếm số đơn theo từng ngày trong tháng, bỏ qua Thùng rác và tháng khác', async () => {
    await api('POST', '/api/don-kinh', { ten: 'A', ngayDat: '2026-11-03' });
    await api('POST', '/api/don-kinh', { ten: 'B', ngayDat: '2026-11-03' });
    await api('POST', '/api/don-kinh', { ten: 'C', ngayDat: '2026-11-15' });
    await api('POST', '/api/don-kinh', { ten: 'D', ngayDat: '2026-10-31' });
    const { body: bo } = await api('POST', '/api/don-kinh', { ten: 'E', ngayDat: '2026-11-15' });
    await api('POST', `/api/don-kinh/${bo.id}/thung-rac`);

    const r = await api('GET', '/api/lich?thang=2026-11');
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ '2026-11-03': 2, '2026-11-15': 1 });
  });

  it('từ chối tháng sai định dạng', async () => {
    expect((await api('GET', '/api/lich?thang=11-2026')).status).toBe(400);
  });
});

describe('Tổng', () => {
  it('tìm theo tên không cần dấu, hoặc theo SĐT; mới đặt nhất lên đầu', async () => {
    const { body: a } = await api('POST', '/api/don-kinh', { ten: 'Nguyễn Văn An', ngayDat: '2026-11-02' });
    await api('PATCH', `/api/don-kinh/${a.id}`, { field: 'sdt', value: '0987654321' });
    await api('POST', '/api/don-kinh', { ten: 'Nguyễn Thị Bình', ngayDat: '2026-11-20' });
    await api('POST', '/api/don-kinh', { ten: 'Trần Chi', ngayDat: '2026-11-10' });

    const ten = (r: { body: { ten: string }[] }) => r.body.map((d) => d.ten);
    expect(ten(await api('GET', '/api/tong?q=nguyen'))).toEqual(['NGUYỄN THỊ BÌNH', 'NGUYỄN VĂN AN']);
    expect(ten(await api('GET', '/api/tong?q=654321'))).toEqual(['NGUYỄN VĂN AN']);
    expect(ten(await api('GET', '/api/tong'))).toEqual(['NGUYỄN THỊ BÌNH', 'TRẦN CHI', 'NGUYỄN VĂN AN']);
  });

  it('lọc theo tháng và bỏ qua Thùng rác', async () => {
    await api('POST', '/api/don-kinh', { ten: 'Tháng mười', ngayDat: '2026-10-05' });
    await api('POST', '/api/don-kinh', { ten: 'Tháng mười một', ngayDat: '2026-11-05' });
    const { body: bo } = await api('POST', '/api/don-kinh', { ten: 'Bỏ', ngayDat: '2026-11-06' });
    await api('POST', `/api/don-kinh/${bo.id}/thung-rac`);
    const r = await api('GET', '/api/tong?thang=2026-11');
    expect(r.body.map((d: { ten: string }) => d.ten)).toEqual(['THÁNG MƯỜI MỘT']);
  });
});

describe('Danh sách lựa chọn', () => {
  it('có sẵn các giá trị mặc định', async () => {
    const r = await api('GET', '/api/danh-sach');
    expect(r.status).toBe(200);
    expect(r.body.nguon).toEqual(['Kính sẵn', 'Ký gửi', 'Kính đặt', 'Đặt đánh']);
    expect(r.body.ttTrong).toEqual(['Chưa đặt', 'Đã đặt – đang giao', 'Đã có']);
    expect(r.body.ttKinh).toEqual(['Chưa cắt', 'Đã cắt – chưa trả', 'Ship', 'Đã trả']);
    expect(r.body.phanHoi).toEqual(['Tốt', 'Không tốt', 'Sự cố', 'Khác']);
    expect(r.body.hang).toContain('FANO');
    expect(r.body.nhanVien).toEqual([]);
  });

  it('thêm giá trị qua "Khác…" thì giá trị đó có trong danh sách cho mọi đơn sau', async () => {
    const r = await api('POST', '/api/danh-sach/nguon', { giaTri: '  Mượn tròng  ' });
    expect(r.status).toBe(201);
    expect(r.body).toEqual(['Kính sẵn', 'Ký gửi', 'Kính đặt', 'Đặt đánh', 'Mượn tròng']);
    expect((await api('GET', '/api/danh-sach')).body.nguon).toContain('Mượn tròng');
  });

  it('không thêm trùng, kể cả khác hoa thường', async () => {
    await api('POST', '/api/danh-sach/hang', { giaTri: 'Rodenstock' });
    const r = await api('POST', '/api/danh-sach/hang', { giaTri: 'RODENSTOCK' });
    expect(r.body.filter((h: string) => h.toLowerCase() === 'rodenstock')).toHaveLength(1);
  });

  it('thêm được Nhân viên để chọn Người tư vấn và Người cắt', async () => {
    const r = await api('POST', '/api/danh-sach/nhanVien', { giaTri: 'Lan' });
    expect(r.body).toEqual(['Lan']);
  });

  it('từ chối danh sách không cho thêm và giá trị rỗng', async () => {
    expect((await api('POST', '/api/danh-sach/ttKinh', { giaTri: 'Mất kính' })).status).toBe(400);
    expect((await api('POST', '/api/danh-sach/khongCo', { giaTri: 'x' })).status).toBe(400);
    expect((await api('POST', '/api/danh-sach/hang', { giaTri: '  ' })).status).toBe(400);
  });

  it('gợi ý Loại tròng từ các loại đã nhập, không trùng', async () => {
    for (const [ten, loai] of [['A', 'FANO 1.61'], ['B', 'ZEISS 1.60'], ['C', 'FANO 1.61'], ['D', '']]) {
      const { body } = await api('POST', '/api/don-kinh', { ten });
      if (loai) await api('PATCH', `/api/don-kinh/${body.id}`, { field: 'loai', value: loai });
    }
    const r = await api('GET', '/api/danh-sach');
    expect(r.body.goiYLoai).toEqual(['FANO 1.61', 'ZEISS 1.60']);
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

describe('Địa chỉ mở app trên thiết bị khác', () => {
  it('trả link mạng nội bộ đã ghép cổng', async () => {
    const r = await api('GET', '/api/dia-chi');
    expect(r.status).toBe(200);
    expect(r.body.links).toEqual([`http://192.168.1.20:${server.port}`]);
  });
});

describe('Lọc địa chỉ mạng nội bộ', () => {
  it('bỏ card ảo, địa chỉ nội bộ máy và 169.254.*; Wi-Fi 192.168.* lên đầu', async () => {
    const { locDiaChi } = await import('../src/server/cau-hinh.js');
    const v4 = (address: string, internal = false) => ({ address, family: 'IPv4', internal });
    expect(locDiaChi({
      'vEthernet (WSL)': [v4('172.20.16.1')],
      Ethernet: [v4('10.0.0.5')],
      'Wi-Fi': [v4('192.168.1.20'), { address: 'fe80::1', family: 'IPv6', internal: false }],
      'Loopback Pseudo-Interface 1': [v4('127.0.0.1', true)],
      'Ethernet 2': [v4('169.254.10.3')],
    })).toEqual(['192.168.1.20', '10.0.0.5']);
  });
});
