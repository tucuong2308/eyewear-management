import { afterEach, describe, expect, it } from 'vitest';
import { createServer, type Server } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CAI_DAT, TAB, TAB_XEM, docCaiDat, ghiNhanSuaTay, khoiTao, xuLyYeuCau } from '../src/apps-script/xu-ly.js';
import { TIEU_DE_TONG } from '../src/core/bo-cuc.js';
import { KenhAppsScript } from '../src/server/kenh-apps-script.js';
import { startServer } from '../src/server/app.js';
import { BangTinhGia } from './bang-tinh-gia.js';

const LUC = '2026-11-27T10:00:00Z';
let dem = 0;
const ngauNhien = () => `nn${++dem}`;

function sheetMoi() {
  const b = new BangTinhGia();
  khoiTao(b, ngauNhien);
  return { b, khoa: docCaiDat(b)[CAI_DAT.khoa]! };
}

describe('Apps Script: khởi tạo Sheet', () => {
  it('tạo đủ tab, tiêu đề tiếng Việt, danh sách mặc định, khóa và mật khẩu ngẫu nhiên; chạy lại không đổi', () => {
    const { b, khoa } = sheetMoi();
    expect([...b.tabs.keys()]).toEqual([TAB.don, 'KÍNH HẸN', 'SỰ CỐ', TAB.nhatKy, TAB.danhSach, TAB.caiDat]);
    expect(b.an.has(TAB.nhatKy)).toBe(true);
    // TỔNG giống file mẫu, Nguồn tròng là 4 ô tick
    expect(b.doc(TAB.don)[0]).toEqual(TIEU_DE_TONG);
    expect(b.cotTick.get(TAB.don)).toEqual([9, 10, 11, 12]);
    // cột MÃ ĐƠN bị khóa (#13)
    expect([...b.khoa.get(TAB.don)!]).toEqual([TIEU_DE_TONG.indexOf('MÃ ĐƠN')]);
    // KÍNH HẸN, SỰ CỐ là công thức lọc từ TỔNG, đặt ở ô A2
    for (const x of TAB_XEM) {
      expect(b.doc(x.ten)[0]).toEqual(x.tieuDe);
      expect(b.congThuc.get(`${x.ten}!1,0`)).toBe(x.congThuc);
    }
    expect(b.doc(TAB.danhSach).map((h) => h[1])).toEqual(['Nguồn tròng', 'Kính sẵn', 'Ký gửi', 'Kính đặt', 'Đặt đánh', '', '', '']);
    const cd = docCaiDat(b);
    expect(cd[CAI_DAT.ten]).toBe('cuahang');
    expect(cd[CAI_DAT.matKhau]).toBeTruthy();
    expect(khoa.length).toBeGreaterThan(4);
    khoiTao(b, ngauNhien);
    expect(docCaiDat(b)[CAI_DAT.khoa]).toBe(khoa);
  });
});

describe('Apps Script: giao kèo đồng bộ', () => {
  it('sai khóa thì từ chối', () => {
    const { b } = sheetMoi();
    expect(xuLyYeuCau(b, { hanhDong: 'keo', khoa: 'sai', moc: 0 }, LUC)).toEqual({ ok: false, loi: 'Sai khóa Máy quầy' });
  });

  it('đẩy tạo dòng cho đơn mới, ghi đúng cột, mỗi đơn một dòng; kéo trả đúng thứ tự và mốc', () => {
    const { b, khoa } = sheetMoi();
    xuLyYeuCau(b, { hanhDong: 'day', khoa, thayDoi: [
      { id: 'd1', truong: 'ten', giaTri: 'AN' }, { id: 'd1', truong: 'sdt', giaTri: '0912' },
      { id: 'd2', truong: 'ten', giaTri: 'BÌNH' }, { id: 'd1', truong: 'thungRac', giaTri: '1' },
    ] }, LUC);
    const don = b.doc(TAB.don);
    expect(don).toHaveLength(3);
    const tieuDe = don[0]!;
    expect(don[1]![tieuDe.indexOf('SDT LIÊN HỆ')]).toBe('0912');
    expect(don[1]![tieuDe.indexOf('THÙNG RÁC')]).toBe('Có');
    expect(don[1]![tieuDe.indexOf('MÃ ĐƠN')]).toBe('d1');
    expect(don[2]![tieuDe.indexOf('MÃ ĐƠN')]).toBe('d2');

    const k = xuLyYeuCau(b, { hanhDong: 'keo', khoa, moc: 2 }, LUC);
    expect(k).toMatchObject({ ok: true, moc: 4, thayDoi: [{ id: 'd2', truong: 'ten', giaTri: 'BÌNH' }, { id: 'd1', truong: 'thungRac', giaTri: '1' }] });
  });

  it('ghi gộp: một lô đẩy chỉ gọi ghi Sheet vài lần và không ghi đè dòng không đổi', () => {
    const { b, khoa } = sheetMoi();
    xuLyYeuCau(b, { hanhDong: 'day', khoa, thayDoi: ['d1', 'd2', 'd3'].map((id) => ({ id, truong: 'ten', giaTri: id })) }, LUC);
    b.lanGhi = [];
    const thayDoi = [{ id: 'd1', truong: 'sdt', giaTri: '01' }, { id: 'd3', truong: 'sdt', giaTri: '03' }];
    for (let i = 0; i < 100; i++) {
      for (const truong of ['ten', 'ngayDat', 'mp', 'mt', 'ttKinh']) thayDoi.push({ id: `moi-${i}`, truong, giaTri: `${truong}-${i}` });
    }
    xuLyYeuCau(b, { hanhDong: 'day', khoa, thayDoi }, LUC);

    // d1 (dòng 1) riêng; d3 (dòng 3) liền với 100 dòng mới nên chung một vùng; d2 không ghi lại; nhật ký một lần
    expect(b.lanGhi).toEqual([
      { ten: TAB.don, hangDau: 1, soHang: 1 },
      { ten: TAB.don, hangDau: 3, soHang: 101 },
      { ten: TAB.nhatKy, hangDau: 4, soHang: 502 },
    ]);
    const don = b.doc(TAB.don);
    const tieuDe = don[0]!;
    expect(don).toHaveLength(104);
    expect(don[3]![tieuDe.indexOf('SDT LIÊN HỆ')]).toBe('03');
    expect(don[103]![tieuDe.indexOf('MT')]).toBe('mt-99');
    expect(xuLyYeuCau(b, { hanhDong: 'keo', khoa, moc: 0 }, LUC)).toMatchObject({ moc: 505 });
  });

  it('bỏ qua trường lạ', () => {
    const { b, khoa } = sheetMoi();
    xuLyYeuCau(b, { hanhDong: 'day', khoa, thayDoi: [{ id: 'd1', truong: 'xoaHet', giaTri: 'x' }] }, LUC);
    expect(b.doc(TAB.don)).toHaveLength(1);
  });

  it('sửa tay trên tab TỔNG được ghi nhật ký để Máy quầy kéo về; sửa tiêu đề hay cột Mã đơn thì không', () => {
    const { b, khoa } = sheetMoi();
    xuLyYeuCau(b, { hanhDong: 'day', khoa, thayDoi: [{ id: 'd1', truong: 'ten', giaTri: 'AN' }] }, LUC);
    const tieuDe = b.doc(TAB.don)[0]!;
    const cotHen = tieuDe.indexOf('NGÀY HẸN');
    ghiNhanSuaTay(b, TAB.don, 1, cotHen, '2026-11-30', LUC);
    ghiNhanSuaTay(b, TAB.don, 0, cotHen, 'tiêu đề', LUC);
    ghiNhanSuaTay(b, TAB.don, 1, tieuDe.indexOf('MÃ ĐƠN'), 'đổi mã', LUC);
    ghiNhanSuaTay(b, TAB.danhSach, 1, 1, 'khác tab', LUC);
    expect(xuLyYeuCau(b, { hanhDong: 'keo', khoa, moc: 1 }, LUC)).toMatchObject({
      ok: true, moc: 2, thayDoi: [{ id: 'd1', truong: 'ngayHen', giaTri: '2026-11-30' }],
    });
  });

  it('nguồn tròng: đẩy lên thì tick đúng ô; tick ô khác trên Sheet thì bỏ tick ô cũ và Máy quầy nhận nguồn mới', () => {
    const { b, khoa } = sheetMoi();
    xuLyYeuCau(b, { hanhDong: 'day', khoa, thayDoi: [{ id: 'd1', truong: 'nguon', giaTri: 'Kính sẵn' }] }, LUC);
    const tieuDe = b.doc(TAB.don)[0]!;
    const o = (td: string) => b.doc(TAB.don)[1]![tieuDe.indexOf(td)];
    expect([o('KÍNH SẴN'), o('KÝ GỬI'), o('KÍNH ĐẶT'), o('ĐẶT ĐÁNH')]).toEqual(['TRUE', 'FALSE', 'FALSE', 'FALSE']);

    // nhân viên tick ô KÍNH ĐẶT trên Sheet (onEdit chạy sau khi ô đã đổi)
    b.tabs.get(TAB.don)![1]![tieuDe.indexOf('KÍNH ĐẶT')] = 'TRUE';
    b.lanGhi = [];
    ghiNhanSuaTay(b, TAB.don, 1, tieuDe.indexOf('KÍNH ĐẶT'), 'TRUE', LUC);
    // chỉ ghi lại ô tick bị bỏ (KÍNH SẴN) và nhật ký, không ghi cả dòng (cột MÃ ĐƠN đã khóa)
    expect(b.lanGhi.map((g) => g.ten)).toEqual([TAB.don, TAB.nhatKy]);
    expect([o('KÍNH SẴN'), o('KÍNH ĐẶT')]).toEqual(['FALSE', 'TRUE']);
    expect(xuLyYeuCau(b, { hanhDong: 'keo', khoa, moc: 1 }, LUC)).toMatchObject({
      ok: true, moc: 2, thayDoi: [{ id: 'd1', truong: 'nguon', giaTri: 'Kính đặt' }],
    });

    // nguồn thêm qua "Khác…" nằm ở NGUỒN KHÁC, không tick ô nào
    xuLyYeuCau(b, { hanhDong: 'day', khoa, thayDoi: [{ id: 'd1', truong: 'nguon', giaTri: 'Mượn tròng' }] }, LUC);
    expect([o('KÍNH ĐẶT'), o('NGUỒN KHÁC')]).toEqual(['FALSE', 'Mượn tròng']);
  });
});

it('kéo trả kèm tài khoản trong tab Cài đặt (tên, mật khẩu)', () => {
  const { b, khoa } = sheetMoi();
  const cd = docCaiDat(b);
  expect(xuLyYeuCau(b, { hanhDong: 'keo', khoa, moc: 0 }, LUC)).toMatchObject({
    taiKhoan: { ten: cd[CAI_DAT.ten], matKhau: cd[CAI_DAT.matKhau] },
  });
});

describe('Từ đầu đến cuối: exe ↔ HTTP ↔ phần xử lý Apps Script', () => {
  let http: Server | undefined;
  let dir: string | undefined;
  afterEach(() => {
    http?.close();
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it('đơn tạo ở Máy quầy lên Sheet; ô sửa tay trên Sheet về Máy quầy', async () => {
    const { b, khoa } = sheetMoi();
    const tk = { ten: 'cuahang', matKhau: 'mk' };
    b.datCaiDat(TAB.caiDat, CAI_DAT.matKhau, tk.matKhau);
    http = createServer(async (req, res) => {
      let s = '';
      for await (const c of req) s += c;
      res.end(JSON.stringify(xuLyYeuCau(b, JSON.parse(s), LUC)));
    });
    await new Promise<void>((r) => http!.listen(0, '127.0.0.1', r));
    const url = `http://127.0.0.1:${(http.address() as { port: number }).port}`;

    dir = mkdtempSync(join(tmpdir(), 'so-don-kinh-e2e-'));
    const server = await startServer({
      fileDuLieu: join(dir, 'So-don-kinh.xlsx'), port: 0, host: '127.0.0.1', today: () => '2026-11-27', taiKhoan: tk,
      kenhSheet: new KenhAppsScript({ url, khoa }), chuKyDongBo: 0,
    });
    try {
      const base = `http://127.0.0.1:${server.port}`;
      const dn = await fetch(base + '/api/dang-nhap', { method: 'POST', body: JSON.stringify(tk), headers: { 'content-type': 'application/json' } });
      const cookie = dn.headers.get('set-cookie')!.split(';')[0]!;
      const goi = (m: string, p: string, body?: unknown) =>
        fetch(base + p, { method: m, headers: { cookie, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }).then((r) => r.json());

      const don = await goi('POST', '/api/don-kinh', { ten: 'Đầu cuối' });
      await server.dongBo();
      const bang = b.doc(TAB.don);
      expect(bang).toHaveLength(2);
      expect(bang[1]![bang[0]!.indexOf('MÃ ĐƠN')]).toBe(don.id);
      expect(bang[1]![bang[0]!.indexOf('TÊN')]).toBe('ĐẦU CUỐI');

      ghiNhanSuaTay(b, TAB.don, 1, bang[0]!.indexOf('SDT LIÊN HỆ'), '0933333333', LUC);
      await server.dongBo();
      expect((await goi('GET', '/api/don-kinh?ngayDat=2026-11-27'))[0].sdt).toBe('0933333333');
    } finally {
      await server.close();
    }
  });
});
