// Kho Đơn kính của bản online: Cloudflare D1 (SQLite trên Cloudflare), ADR 0006.
// Cùng giao diện Kho với file Excel của Máy quầy; mỗi thay đổi ghi kèm ô chờ đẩy lên Sheet trong một lô (nguyên tử).
import {
  DANH_SACH_MAC_DINH, TRUONG_SUA_DUOC, donMoi, goiYLoaiTrong,
  type DanhSach, type DonKinh, type LoaiDanhSach, type TruongSuaDuoc,
} from '../core/don-kinh.js';
import type { ThayDoiO, TruongDongBo } from '../core/dong-bo.js';
import type { Kho, OChoDay } from '../server/api.js';

/** Phần D1 mà kho cần (khớp D1Database của Cloudflare; test dùng bản giả trên node:sqlite). */
export interface D1 {
  prepare(sql: string): D1Lenh;
  batch(lenh: D1Lenh[]): Promise<unknown[]>;
}
export interface D1Lenh {
  bind(...v: unknown[]): D1Lenh;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  run(): Promise<{ meta: { changes: number } }>;
}

const COT = ['id', ...TRUONG_SUA_DUOC];
const CHON = [...COT.map((c) => `"${c}"`), 'thung_rac AS thungRac'].join(',');
const cotCua = (t: TruongDongBo) => (t === 'thungRac' ? 'thung_rac' : `"${t}"`);

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS don_kinh (
    stt INTEGER PRIMARY KEY AUTOINCREMENT,
    id TEXT NOT NULL UNIQUE,
    ${TRUONG_SUA_DUOC.map((f) => `"${f}" TEXT NOT NULL DEFAULT ''`).join(',\n    ')},
    thung_rac INTEGER NOT NULL DEFAULT 0
  )`,
  'CREATE INDEX IF NOT EXISTS don_kinh_ngay_dat ON don_kinh ("ngayDat")',
  `CREATE TABLE IF NOT EXISTS cho_day (
    id TEXT NOT NULL, truong TEXT NOT NULL, gia_tri TEXT NOT NULL, luc INTEGER NOT NULL,
    PRIMARY KEY (id, truong)
  )`,
  'CREATE TABLE IF NOT EXISTS trang_thai (khoa TEXT PRIMARY KEY, gia_tri TEXT NOT NULL)',
  'CREATE TABLE IF NOT EXISTS phien (ma_bam TEXT PRIMARY KEY, het_han INTEGER NOT NULL)',
  `CREATE TABLE IF NOT EXISTS danh_sach (
    stt INTEGER PRIMARY KEY AUTOINCREMENT, loai TEXT NOT NULL, gia_tri TEXT NOT NULL, UNIQUE (loai, gia_tri)
  )`,
];

function doc(r: Record<string, unknown>): DonKinh {
  return { ...(r as unknown as DonKinh), thungRac: r.thungRac === 1 };
}

export class KhoD1 implements Kho {
  constructor(private db: D1) {}

  /** Tạo bảng nếu chưa có và nạp danh sách mặc định lần đầu. Chạy lại an toàn. */
  async khoiTao() {
    await this.db.batch(SCHEMA.map((s) => this.db.prepare(s)));
    const co = await this.db.prepare('SELECT COUNT(*) AS n FROM danh_sach').first<{ n: number }>();
    if (!co?.n) {
      const them = this.db.prepare('INSERT OR IGNORE INTO danh_sach (loai, gia_tri) VALUES (?, ?)');
      await this.db.batch(Object.entries(DANH_SACH_MAC_DINH).flatMap(([loai, ds]) => ds.map((v) => them.bind(loai, v))));
    }
  }

  async danhSach(): Promise<DanhSach & { goiYLoai: string[] }> {
    const ds = Object.fromEntries(Object.keys(DANH_SACH_MAC_DINH).map((k) => [k, [] as string[]])) as DanhSach;
    const { results } = await this.db.prepare('SELECT loai, gia_tri FROM danh_sach ORDER BY stt').all<{ loai: LoaiDanhSach; gia_tri: string }>();
    for (const r of results) ds[r.loai]?.push(r.gia_tri);
    return { ...ds, goiYLoai: goiYLoaiTrong(await this.tatCa()) };
  }

  async themVaoDanhSach(loai: LoaiDanhSach, giaTri: string) {
    await this.db.prepare('INSERT OR IGNORE INTO danh_sach (loai, gia_tri) VALUES (?, ?)').bind(loai, giaTri).run();
  }

  async lay(id: string): Promise<DonKinh | undefined> {
    const r = await this.db.prepare(`SELECT ${CHON} FROM don_kinh WHERE id = ?`).bind(id).first();
    return r ? doc(r) : undefined;
  }

  async tatCa(): Promise<DonKinh[]> {
    return (await this.db.prepare(`SELECT ${CHON} FROM don_kinh ORDER BY stt`).all()).results.map(doc);
  }

  async thungRac(): Promise<DonKinh[]> {
    return (await this.db.prepare(`SELECT ${CHON} FROM don_kinh WHERE thung_rac = 1 ORDER BY stt`).all()).results.map(doc);
  }

  async theoNgayDat(ngay: string): Promise<DonKinh[]> {
    return (await this.db.prepare(`SELECT ${CHON} FROM don_kinh WHERE "ngayDat" = ? AND thung_rac = 0 ORDER BY stt`).bind(ngay).all())
      .results.map(doc);
  }

  async tao(ten: string, ngayDat: string): Promise<DonKinh> {
    const don = donMoi(crypto.randomUUID(), ten, ngayDat);
    await this.db.batch([
      this.db.prepare(`INSERT INTO don_kinh (${COT.map((c) => `"${c}"`).join(',')}) VALUES (${COT.map(() => '?').join(',')})`)
        .bind(...COT.map((c) => String(don[c as keyof DonKinh]))),
      ...TRUONG_SUA_DUOC.map((f) => this.ghiCho(don.id, f, don[f])),
    ]);
    return don;
  }

  async sua(id: string, field: TruongSuaDuoc, value: string): Promise<DonKinh | undefined> {
    if (!(await this.lay(id))) return undefined;
    // field đã được kiểm tra là một trong TRUONG_SUA_DUOC trước khi tới đây
    await this.db.batch([
      this.db.prepare(`UPDATE don_kinh SET "${field}" = ? WHERE id = ?`).bind(value, id),
      this.ghiCho(id, field, value),
    ]);
    return this.lay(id);
  }

  async datThungRac(id: string, thungRac: boolean): Promise<DonKinh | undefined> {
    if (!(await this.lay(id))) return undefined;
    await this.db.batch([
      this.db.prepare('UPDATE don_kinh SET thung_rac = ? WHERE id = ?').bind(thungRac ? 1 : 0, id),
      this.ghiCho(id, 'thungRac', thungRac ? '1' : ''),
    ]);
    return this.lay(id);
  }

  // ---- Đồng bộ với Sheet ----

  async choDay(): Promise<OChoDay[]> {
    const { results } = await this.db.prepare('SELECT id, truong, gia_tri, luc FROM cho_day ORDER BY luc')
      .all<{ id: string; truong: TruongDongBo; gia_tri: string; luc: number }>();
    return results.map((r) => ({ id: r.id, truong: r.truong, giaTri: r.gia_tri, luc: r.luc }));
  }

  /** Bỏ các ô đã đẩy xong; ô bị sửa tiếp trong lúc đẩy (luc khác) vẫn giữ lại để đẩy lần sau. */
  async xoaChoDay(da: OChoDay[]) {
    if (!da.length) return;
    const xoa = this.db.prepare('DELETE FROM cho_day WHERE id = ? AND truong = ? AND luc = ?');
    await this.db.batch(da.map((o) => xoa.bind(o.id, o.truong, o.luc)));
  }

  async apDungTuSheet(ds: ThayDoiO[], mocMoi: number) {
    // Ô đang chờ đẩy (sửa ở đây chưa lên Sheet) thì bỏ qua: local thắng
    const dangCho = new Set((await this.choDay()).map((o) => `${o.id}\t${o.truong}`));
    const lenh: D1Lenh[] = [];
    for (const o of ds) {
      if (dangCho.has(`${o.id}\t${o.truong}`)) continue;
      lenh.push(this.db.prepare('INSERT OR IGNORE INTO don_kinh (id) VALUES (?)').bind(o.id));
      lenh.push(this.db.prepare(`UPDATE don_kinh SET ${cotCua(o.truong)} = ? WHERE id = ?`)
        .bind(o.truong === 'thungRac' ? (o.giaTri ? 1 : 0) : o.giaTri, o.id));
    }
    lenh.push(this.datTrangThaiLenh('mocKeo', String(mocMoi)));
    await this.db.batch(lenh);
  }

  async trangThai(khoa: string): Promise<string | undefined> {
    return (await this.db.prepare('SELECT gia_tri FROM trang_thai WHERE khoa = ?').bind(khoa).first<{ gia_tri: string }>())?.gia_tri;
  }

  async datTrangThai(khoa: string, giaTri: string) {
    await this.datTrangThaiLenh(khoa, giaTri).run();
  }

  private datTrangThaiLenh(khoa: string, giaTri: string) {
    return this.db.prepare('INSERT INTO trang_thai (khoa, gia_tri) VALUES (?, ?) ON CONFLICT(khoa) DO UPDATE SET gia_tri = excluded.gia_tri')
      .bind(khoa, giaTri);
  }

  private ghiCho(id: string, truong: TruongDongBo, giaTri: string) {
    return this.db.prepare(`INSERT INTO cho_day (id, truong, gia_tri, luc)
      VALUES (?, ?, ?, (SELECT COALESCE(MAX(luc), 0) + 1 FROM cho_day))
      ON CONFLICT(id, truong) DO UPDATE SET gia_tri = excluded.gia_tri, luc = excluded.luc`).bind(id, truong, giaTri);
  }

  // ---- Phiên đăng nhập ----

  async taoPhien(maBam: string, hetHan: number) {
    await this.db.prepare('INSERT INTO phien (ma_bam, het_han) VALUES (?, ?)').bind(maBam, hetHan).run();
  }

  async phienConHan(maBam: string, bayGio: number): Promise<boolean> {
    const r = await this.db.prepare('SELECT het_han FROM phien WHERE ma_bam = ?').bind(maBam).first<{ het_han: number }>();
    if (r && r.het_han > bayGio) return true;
    if (r) await this.xoaPhien(maBam);
    return false;
  }

  async xoaPhien(maBam: string) {
    await this.db.prepare('DELETE FROM phien WHERE ma_bam = ?').bind(maBam).run();
  }
}
