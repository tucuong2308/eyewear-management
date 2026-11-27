// Máy chủ web của exe: API Đơn kính + phục vụ giao diện.
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { chuanHoa, laTruongSuaDuoc } from '../core/don-kinh.js';
import { KhoDonKinh } from './kho.js';

export interface ServerOptions {
  dbPath: string;
  port: number;
  host?: string;
  /** Ngày hôm nay dạng YYYY-MM-DD theo giờ máy; tiêm vào để test. */
  today?: () => string;
  /** Thư mục chứa giao diện đã build (index.html, app.js). */
  webDir?: string;
}

export interface RunningServer {
  port: number;
  close(): Promise<void>;
}

export function homNayTheoMay(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export async function startServer(opts: ServerOptions): Promise<RunningServer> {
  const kho = new KhoDonKinh(opts.dbPath);
  const today = opts.today ?? homNayTheoMay;
  const webDir = opts.webDir ?? join(ROOT, 'dist', 'web');

  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', 'http://localhost');
      if (url.pathname.startsWith('/api/')) return await xuLyApi(req, res, url);
      return await phucVuGiaoDien(res, url.pathname);
    } catch (e) {
      guiJson(res, 500, { loi: 'Lỗi máy chủ', chiTiet: String(e) });
    }
  });

  async function xuLyApi(req: IncomingMessage, res: ServerResponse, url: URL) {
    if (url.pathname === '/api/don-kinh' && req.method === 'GET') {
      const ngay = url.searchParams.get('ngayDat') ?? today();
      return guiJson(res, 200, kho.theoNgayDat(ngay));
    }
    if (url.pathname === '/api/don-kinh' && req.method === 'POST') {
      const body = await docJson(req);
      const ten = chuanHoa('ten', body.ten);
      if (!ten.ok) return guiJson(res, 400, { loi: ten.loi });
      const ngay = chuanHoa('ngayDat', body.ngayDat || today());
      if (!ngay.ok) return guiJson(res, 400, { loi: ngay.loi });
      return guiJson(res, 201, kho.tao(ten.value, ngay.value));
    }
    const m = url.pathname.match(/^\/api\/don-kinh\/([^/]+)$/);
    if (m && req.method === 'PATCH') {
      const id = decodeURIComponent(m[1]!);
      const body = await docJson(req);
      const field = String(body.field ?? '');
      if (!laTruongSuaDuoc(field)) return guiJson(res, 400, { loi: `Không sửa được trường "${field}"` });
      const v = chuanHoa(field, body.value);
      if (!v.ok) return guiJson(res, 400, { loi: v.loi });
      const don = kho.sua(id, field, v.value);
      if (!don) return guiJson(res, 404, { loi: 'Không tìm thấy Đơn kính' });
      return guiJson(res, 200, don);
    }
    return guiJson(res, 404, { loi: 'Không có API này' });
  }

  async function phucVuGiaoDien(res: ServerResponse, path: string) {
    const files: Record<string, [string, string]> = {
      '/': ['index.html', 'text/html; charset=utf-8'],
      '/app.js': ['app.js', 'text/javascript; charset=utf-8'],
      '/app.js.map': ['app.js.map', 'application/json'],
    };
    const f = files[path];
    if (!f) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      return res.end('Không tìm thấy');
    }
    try {
      const data = await readFile(join(webDir, f[0]));
      res.writeHead(200, { 'content-type': f[1], 'cache-control': 'no-store' });
      res.end(data);
    } catch {
      res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('Chưa build giao diện. Chạy: npm run build:web');
    }
  }

  await new Promise<void>((resolve) => server.listen(opts.port, opts.host ?? '0.0.0.0', resolve));
  const addr = server.address();
  const port = typeof addr === 'object' && addr ? addr.port : opts.port;

  return {
    port,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.closeAllConnections();
        server.close((err) => {
          kho.dong();
          err ? reject(err) : resolve();
        });
      }),
  };
}

function guiJson(res: ServerResponse, status: number, data: unknown) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

async function docJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  if (!chunks.length) return {};
  try {
    const v = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
}
