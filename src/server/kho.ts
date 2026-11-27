// Kho Đơn kính trên Máy quầy: một file SQLite.
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import type { DatabaseSync as DatabaseSyncT } from 'node:sqlite';

// Nạp qua require: Vite/Vitest chưa nhận 'node:sqlite' là module có sẵn của Node.
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
type DatabaseSync = DatabaseSyncT;
import {
  DANH_SACH_MAC_DINH, TRUONG_SUA_DUOC, donMoi, goiYLoaiTrong,
  type DanhSach, type DonKinh, type LoaiDanhSach, type TruongSuaDuoc,
} from '../core/don-kinh.js';
import type { ThayDoiO, TruongDongBo } from '../core/dong-bo.js';

/** Một ô đã sửa ở Máy quầy nhưng chưa đẩy lên Sheet; `luc` tăng dần để biết ô có bị sửa tiếp không. */
export interface OChoDay extends ThayDoiO {
  luc: number;
}

const cotCua = (t: TruongDongBo) => (t === 'thungRac' ? 'thung_rac' : `"${t}"`);

const COT = TRUONG_SUA_DUOC.map((f) => `"${f}" TEXT NOT NULL DEFAULT ''`).join(',\n  ');

export class KhoDonKinh {
  private db: DatabaseSync;

  constructor(dbPath: string) {
    this.db = new DatabaseSync(dbPath);
    this.db.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL;');
    this.db.exec(`CREATE TABLE IF NOT EXISTS don_kinh (
  stt INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT NOT NULL UNIQUE,
  ${COT}
)`);
    const cot = this.db.prepare('PRAGMA table_info(don_kinh)').all() as { name: string }[];
    if (!cot.some((c) => c.name === 'thung_rac')) {
      this.db.exec('ALTER TABLE don_kinh ADD COLUMN thung_rac INTEGER NOT NULL DEFAULT 0');
    }
    // Ô chờ đẩy lên Sheet: ghi cùng giao dịch với thay đổi nên còn nguyên khi tắt máy đột ngột
    this.db.exec(`CREATE TABLE IF NOT EXISTS cho_day (
  id TEXT NOT NULL,
  truong TEXT NOT NULL,
  gia_tri TEXT NOT NULL,
  luc INTEGER NOT NULL,
  PRIMARY KEY (id, truong)
)`);
    this.db.exec('CREATE TABLE IF NOT EXISTS trang_thai (khoa TEXT PRIMARY KEY, gia_tri TEXT NOT NULL)');
    this.db.exec(`CREATE TABLE IF NOT EXISTS phien (
  ma_bam TEXT PRIMARY KEY,
  het_han INTEGER NOT NULL
)`);
    this.db.exec(`CREATE TABLE IF NOT EXISTS danh_sach (
  stt INTEGER PRIMARY KEY AUTOINCREMENT,
  loai TEXT NOT NULL,
  gia_tri TEXT NOT NULL,
  UNIQUE (loai, gia_tri)
)`);
    const dem = this.db.prepare('SELECT COUNT(*) AS n FROM danh_sach').get() as { n: number };
    if (dem.n === 0) {
      const them = this.db.prepare('INSERT INTO danh_sach (loai, gia_tri) VALUES (?, ?)');
      for (const [loai, ds] of Object.entries(DANH_SACH_MAC_DINH)) for (const v of ds) them.run(loai, v);
    }
  }

  danhSach(): DanhSach & { goiYLoai: string[] } {
    const ds = Object.fromEntries(Object.keys(DANH_SACH_MAC_DINH).map((k) => [k, [] as string[]])) as DanhSach;
    const rows = this.db.prepare('SELECT loai, gia_tri FROM danh_sach ORDER BY stt').all() as { loai: LoaiDanhSach; gia_tri: string }[];
    for (const r of rows) ds[r.loai]?.push(r.gia_tri);
    return { ...ds, goiYLoai: goiYLoaiTrong(this.tatCa()) };
  }

  themVaoDanhSach(loai: LoaiDanhSach, giaTri: string) {
    this.db.prepare('INSERT OR IGNORE INTO danh_sach (loai, gia_tri) VALUES (?, ?)').run(loai, giaTri);
  }

  tao(ten: string, ngayDat: string): DonKinh {
    const don = donMoi(randomUUID(), ten, ngayDat);
    const cols = ['id', ...TRUONG_SUA_DUOC];
    this.giaoDich(() => {
      this.db
        .prepare(`INSERT INTO don_kinh (${cols.map((c) => `"${c}"`).join(',')}) VALUES (${cols.map(() => '?').join(',')})`)
        .run(...cols.map((c) => String(don[c as keyof DonKinh])));
      for (const f of TRUONG_SUA_DUOC) this.ghiCho(don.id, f, don[f]);
    });
    return don;
  }

  lay(id: string): DonKinh | undefined {
    const r = this.db.prepare(`SELECT ${this.chon()} FROM don_kinh WHERE id = ?`).get(id);
    return r ? doc(r) : undefined;
  }

  datThungRac(id: string, thungRac: boolean): DonKinh | undefined {
    const doi = this.giaoDich(() => {
      const r = this.db.prepare('UPDATE don_kinh SET thung_rac = ? WHERE id = ?').run(thungRac ? 1 : 0, id);
      if (r.changes) this.ghiCho(id, 'thungRac', thungRac ? '1' : '');
      return r.changes;
    });
    return doi ? this.lay(id) : undefined;
  }

  thungRac(): DonKinh[] {
    return this.db.prepare(`SELECT ${this.chon()} FROM don_kinh WHERE thung_rac = 1 ORDER BY stt`).all().map(doc);
  }

  sua(id: string, field: TruongSuaDuoc, value: string): DonKinh | undefined {
    // field đã được kiểm tra là một trong TRUONG_SUA_DUOC trước khi tới đây
    const doi = this.giaoDich(() => {
      const r = this.db.prepare(`UPDATE don_kinh SET "${field}" = ? WHERE id = ?`).run(value, id);
      if (r.changes) this.ghiCho(id, field, value);
      return r.changes;
    });
    return doi ? this.lay(id) : undefined;
  }

  /** Nhập một Đơn kính có sẵn mã (chuyển dữ liệu cũ). Đã có mã đó thì bỏ qua. Ghi chờ đẩy để lên Sheet. */
  nhapDon(don: DonKinh): boolean {
    const cols = ['id', ...TRUONG_SUA_DUOC];
    return this.giaoDich(() => {
      const r = this.db
        .prepare(`INSERT OR IGNORE INTO don_kinh (${cols.map((c) => `"${c}"`).join(',')}, thung_rac) VALUES (${cols.map(() => '?').join(',')}, ?)`)
        .run(...cols.map((c) => String(don[c as keyof DonKinh])), don.thungRac ? 1 : 0);
      if (!r.changes) return false;
      for (const f of TRUONG_SUA_DUOC) this.ghiCho(don.id, f, don[f]);
      if (don.thungRac) this.ghiCho(don.id, 'thungRac', '1');
      return true;
    });
  }

  // ---- Đồng bộ với Sheet ----

  choDay(): OChoDay[] {
    return (this.db.prepare('SELECT id, truong, gia_tri, luc FROM cho_day ORDER BY luc').all() as {
      id: string; truong: TruongDongBo; gia_tri: string; luc: number;
    }[]).map((r) => ({ id: r.id, truong: r.truong, giaTri: r.gia_tri, luc: r.luc }));
  }

  /** Bỏ các ô đã đẩy xong; ô bị sửa tiếp trong lúc đẩy (luc khác) vẫn giữ lại để đẩy lần sau. */
  xoaChoDay(da: OChoDay[]) {
    const xoa = this.db.prepare('DELETE FROM cho_day WHERE id = ? AND truong = ? AND luc = ?');
    this.giaoDich(() => {
      for (const o of da) xoa.run(o.id, o.truong, o.luc);
    });
  }

  /** Ghi các ô kéo về từ Sheet; bỏ qua ô Máy quầy đang chờ đẩy (local thắng). */
  apDungTuSheet(ds: ThayDoiO[]) {
    const dangCho = this.db.prepare('SELECT 1 FROM cho_day WHERE id = ? AND truong = ?');
    const taoDong = this.db.prepare('INSERT OR IGNORE INTO don_kinh (id) VALUES (?)');
    this.giaoDich(() => {
      for (const o of ds) {
        if (dangCho.get(o.id, o.truong)) continue;
        taoDong.run(o.id);
        const v = o.truong === 'thungRac' ? (o.giaTri ? 1 : 0) : o.giaTri;
        this.db.prepare(`UPDATE don_kinh SET ${cotCua(o.truong)} = ? WHERE id = ?`).run(v, o.id);
      }
    });
  }

  trangThai(khoa: string): string | undefined {
    return (this.db.prepare('SELECT gia_tri FROM trang_thai WHERE khoa = ?').get(khoa) as { gia_tri: string } | undefined)?.gia_tri;
  }

  datTrangThai(khoa: string, giaTri: string) {
    this.db.prepare('INSERT INTO trang_thai (khoa, gia_tri) VALUES (?, ?) ON CONFLICT(khoa) DO UPDATE SET gia_tri = excluded.gia_tri').run(khoa, giaTri);
  }

  private ghiCho(id: string, truong: TruongDongBo, giaTri: string) {
    this.db.prepare(`INSERT INTO cho_day (id, truong, gia_tri, luc)
      VALUES (?, ?, ?, (SELECT COALESCE(MAX(luc), 0) + 1 FROM cho_day))
      ON CONFLICT(id, truong) DO UPDATE SET gia_tri = excluded.gia_tri, luc = excluded.luc`).run(id, truong, giaTri);
  }

  private giaoDich<T>(viec: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const kq = viec();
      this.db.exec('COMMIT');
      return kq;
    } catch (e) {
      this.db.exec('ROLLBACK');
      throw e;
    }
  }

  theoNgayDat(ngay: string): DonKinh[] {
    return this.db.prepare(`SELECT ${this.chon()} FROM don_kinh WHERE ngayDat = ? AND thung_rac = 0 ORDER BY stt`).all(ngay).map(doc);
  }

  /** Mọi đơn, kể cả trong Thùng rác; các quy tắc dùng chung tự loại đơn trong Thùng rác. */
  tatCa(): DonKinh[] {
    return this.db.prepare(`SELECT ${this.chon()} FROM don_kinh ORDER BY stt`).all().map(doc);
  }

  taoPhien(maBam: string, hetHan: number) {
    this.db.prepare('INSERT INTO phien (ma_bam, het_han) VALUES (?, ?)').run(maBam, hetHan);
  }

  phienConHan(maBam: string, bayGio: number): boolean {
    this.db.prepare('DELETE FROM phien WHERE het_han <= ?').run(bayGio);
    return !!this.db.prepare('SELECT 1 FROM phien WHERE ma_bam = ?').get(maBam);
  }

  xoaPhien(maBam: string) {
    this.db.prepare('DELETE FROM phien WHERE ma_bam = ?').run(maBam);
  }

  dong() {
    this.db.close();
  }

  private chon() {
    return [...['id', ...TRUONG_SUA_DUOC].map((c) => `"${c}"`), 'thung_rac AS thungRac'].join(',');
  }
}

function doc(r: unknown): DonKinh {
  const row = r as Record<string, unknown>;
  return { ...(row as DonKinh), thungRac: row.thungRac === 1 };
}
