import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createServer, type Server } from 'node:http';
import worker, { type Env } from '../src/online/worker.js';
import { CAI_DAT, TAB, docCaiDat, ghiNhanSuaTay, khoiTao, xuLyYeuCau } from '../src/apps-script/xu-ly.js';
import { BangTinhGia } from './bang-tinh-gia.js';
import { D1Gia } from './d1-gia.js';

const TK = { ten: 'cuahang', matKhau: 'mk-online' };
const GOC = 'https://so-don-kinh.example.workers.dev';

let env: Env;
let cho: Promise<unknown>[];
let cookie = '';
let http: Server | undefined;

const ctx = { waitUntil: (p: Promise<unknown>) => void cho.push(p) };
/** Chờ các việc chạy ngầm sau khi đã trả lời (đẩy/kéo Sheet). */
const xongNgam = async () => {
  while (cho.length) await Promise.all(cho.splice(0));
};

async function api(method: string, path: string, body?: unknown) {
  const headers: Record<string, string> = { cookie };
  if (body) headers['content-type'] = 'application/json';
  const res = await worker.fetch(new Request(GOC + path, { method, headers, body: body ? JSON.stringify(body) : undefined }), env, ctx);
  const sc = res.headers.get('set-cookie');
  if (sc) cookie = sc.split(';')[0]!;
  return { status: res.status, body: await res.json(), setCookie: sc };
}

beforeEach(async () => {
  cho = [];
  cookie = '';
  env = {
    DB: new D1Gia(),
    ASSETS: { fetch: async (r) => new Response(`tĩnh:${new URL(r.url).pathname}`) },
    TEN_DANG_NHAP: TK.ten,
    MAT_KHAU: TK.matKhau,
  };
});

afterEach(() => {
  http?.close();
  http = undefined;
});

describe('Bản online (Worker + D1)', () => {
  it('trang giao diện lấy từ static assets; API cần đăng nhập; cookie có Secure trên https', async () => {
    const r = await worker.fetch(new Request(GOC + '/'), env, ctx);
    expect(await r.text()).toBe('tĩnh:/');
    expect((await api('GET', '/api/kinh-hen')).status).toBe(401);
    expect((await api('POST', '/api/dang-nhap', { ten: 'cuahang', matKhau: 'sai' })).status).toBe(401);
    const dn = await api('POST', '/api/dang-nhap', TK);
    expect(dn.status).toBe(200);
    expect(dn.setCookie).toMatch(/HttpOnly/);
    expect(dn.setCookie).toMatch(/Secure/);
  });

  it('cùng API với exe: tạo, sửa, Kính hẹn, Hoàn thành, Thùng rác, danh sách; "Mở trên máy khác" là link trang web', async () => {
    await api('POST', '/api/dang-nhap', TK);
    const { body: don } = await api('POST', '/api/don-kinh', { ten: 'Trực tuyến', ngayDat: '2026-11-27' });
    expect(don.ten).toBe('TRỰC TUYẾN');
    await api('PATCH', `/api/don-kinh/${don.id}`, { field: 'ngayHen', value: '2026-11-29' });
    expect((await api('GET', '/api/kinh-hen')).body.map((d: { id: string }) => d.id)).toEqual([don.id]);
    expect((await api('GET', '/api/don-kinh?ngayDat=2026-11-27')).body).toHaveLength(1);

    expect((await api('POST', `/api/don-kinh/${don.id}/hoan-thanh`)).body.ttKinh).toBe('Đã trả');
    expect((await api('GET', '/api/kinh-hen')).body).toEqual([]);

    await api('POST', `/api/don-kinh/${don.id}/thung-rac`);
    expect((await api('GET', '/api/thung-rac')).body).toHaveLength(1);
    expect((await api('PATCH', '/api/don-kinh/khong-co', { field: 'sdt', value: '1' })).status).toBe(404);

    expect((await api('POST', '/api/danh-sach/hang', { giaTri: 'Hãng mới' })).body).toContain('Hãng mới');
    expect((await api('GET', '/api/dia-chi')).body.links).toEqual([GOC]);
  });

  it('đồng bộ với Google Sheet như một Máy quầy: lưu xong thì đẩy ngầm; ô sửa trên Sheet được kéo về theo lịch', async () => {
    // Sheet giả sau một Web App giả (cùng phần xử lý Apps Script thật)
    const b = new BangTinhGia();
    khoiTao(b, () => 'k');
    const khoa = docCaiDat(b)[CAI_DAT.khoa]!;
    http = createServer(async (req, res) => {
      let s = '';
      for await (const c of req) s += c;
      res.end(JSON.stringify(xuLyYeuCau(b, JSON.parse(s), '2026-11-27T10:00:00Z')));
    });
    await new Promise<void>((r) => http!.listen(0, '127.0.0.1', r));
    env.SHEET_URL = `http://127.0.0.1:${(http.address() as { port: number }).port}`;
    env.SHEET_KHOA = khoa;

    await api('POST', '/api/dang-nhap', TK);
    const { body: don } = await api('POST', '/api/don-kinh', { ten: 'Lên Sheet', ngayDat: '2026-11-27' });
    await xongNgam();
    const bang = b.doc(TAB.don);
    const tieuDe = bang[0]!;
    expect(bang[1]![tieuDe.indexOf('MÃ ĐƠN')]).toBe(don.id);
    expect(bang[1]![tieuDe.indexOf('TÊN')]).toBe('LÊN SHEET');
    expect((await api('GET', '/api/dong-bo')).body).toMatchObject({ coSheet: true, soChoDay: 0, loiCuoi: '' });

    // Máy quầy hoặc người sửa tay trên Sheet đổi SĐT; lịch mỗi phút kéo về
    ghiNhanSuaTay(b, TAB.don, 1, tieuDe.indexOf('SDT LIÊN HỆ'), '0977000111', '2026-11-27T10:01:00Z');
    await worker.scheduled({}, env, ctx);
    await xongNgam();
    expect((await api('GET', '/api/don-kinh?ngayDat=2026-11-27')).body[0].sdt).toBe('0977000111');
  });

  it('mất kết nối tới Sheet thì vẫn lưu được, ô chờ đẩy giữ lại cho lần sau', async () => {
    env.SHEET_URL = 'http://127.0.0.1:9/khong-co';
    env.SHEET_KHOA = 'x';
    await api('POST', '/api/dang-nhap', TK);
    const r = await api('POST', '/api/don-kinh', { ten: 'Mất mạng', ngayDat: '2026-11-27' });
    expect(r.status).toBe(201);
    await xongNgam();
    const db = (await api('GET', '/api/dong-bo')).body;
    expect(db.soChoDay).toBeGreaterThan(0);
    expect(db.loiCuoi).toBeTruthy();
  });
});
