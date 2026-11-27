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
    this.db
      .prepare(`INSERT INTO don_kinh (${cols.map((c) => `"${c}"`).join(',')}) VALUES (${cols.map(() => '?').join(',')})`)
      .run(...cols.map((c) => String(don[c as keyof DonKinh])));
    return don;
  }

  lay(id: string): DonKinh | undefined {
    const r = this.db.prepare(`SELECT ${this.chon()} FROM don_kinh WHERE id = ?`).get(id);
    return r ? doc(r) : undefined;
  }

  datThungRac(id: string, thungRac: boolean): DonKinh | undefined {
    const r = this.db.prepare('UPDATE don_kinh SET thung_rac = ? WHERE id = ?').run(thungRac ? 1 : 0, id);
    return r.changes ? this.lay(id) : undefined;
  }

  thungRac(): DonKinh[] {
    return this.db.prepare(`SELECT ${this.chon()} FROM don_kinh WHERE thung_rac = 1 ORDER BY stt`).all().map(doc);
  }

  sua(id: string, field: TruongSuaDuoc, value: string): DonKinh | undefined {
    // field đã được kiểm tra là một trong TRUONG_SUA_DUOC trước khi tới đây
    const r = this.db.prepare(`UPDATE don_kinh SET "${field}" = ? WHERE id = ?`).run(value, id);
    return r.changes ? this.lay(id) : undefined;
  }

  theoNgayDat(ngay: string): DonKinh[] {
    return this.db.prepare(`SELECT ${this.chon()} FROM don_kinh WHERE ngayDat = ? AND thung_rac = 0 ORDER BY stt`).all(ngay).map(doc);
  }

  /** Mọi đơn, kể cả trong Thùng rác; các quy tắc dùng chung tự loại đơn trong Thùng rác. */
  tatCa(): DonKinh[] {
    return this.db.prepare(`SELECT ${this.chon()} FROM don_kinh ORDER BY stt`).all().map(doc);
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
