// Kho Đơn kính trên Máy quầy: một file SQLite.
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import type { DatabaseSync as DatabaseSyncT } from 'node:sqlite';

// Nạp qua require: Vite/Vitest chưa nhận 'node:sqlite' là module có sẵn của Node.
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
type DatabaseSync = DatabaseSyncT;
import { TRUONG_SUA_DUOC, donMoi, type DonKinh, type TruongSuaDuoc } from '../core/don-kinh.js';

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
  }

  tao(ten: string, ngayDat: string): DonKinh {
    const don = donMoi(randomUUID(), ten, ngayDat);
    const cols = ['id', ...TRUONG_SUA_DUOC];
    this.db
      .prepare(`INSERT INTO don_kinh (${cols.map((c) => `"${c}"`).join(',')}) VALUES (${cols.map(() => '?').join(',')})`)
      .run(...cols.map((c) => don[c as keyof DonKinh]));
    return don;
  }

  lay(id: string): DonKinh | undefined {
    return this.db.prepare(`SELECT ${this.chon()} FROM don_kinh WHERE id = ?`).get(id) as DonKinh | undefined;
  }

  sua(id: string, field: TruongSuaDuoc, value: string): DonKinh | undefined {
    // field đã được kiểm tra là một trong TRUONG_SUA_DUOC trước khi tới đây
    const r = this.db.prepare(`UPDATE don_kinh SET "${field}" = ? WHERE id = ?`).run(value, id);
    return r.changes ? this.lay(id) : undefined;
  }

  theoNgayDat(ngay: string): DonKinh[] {
    return this.db.prepare(`SELECT ${this.chon()} FROM don_kinh WHERE ngayDat = ? ORDER BY stt`).all(ngay) as DonKinh[];
  }

  dong() {
    this.db.close();
  }

  private chon() {
    return ['id', ...TRUONG_SUA_DUOC].map((c) => `"${c}"`).join(',');
  }
}
