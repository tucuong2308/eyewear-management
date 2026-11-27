// D1 giả trên node:sqlite để test kho của bản online trên máy (cùng phương ngữ SQLite với D1 thật).
import { createRequire } from 'node:module';
import type { D1, D1Lenh } from '../src/online/kho-d1.js';

// Nạp qua require: Vite/Vitest chưa nhận 'node:sqlite' là module có sẵn của Node.
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');

class LenhGia implements D1Lenh {
  constructor(private db: InstanceType<typeof DatabaseSync>, private sql: string, private v: unknown[] = []) {}
  bind(...v: unknown[]) {
    return new LenhGia(this.db, this.sql, v);
  }
  private stmt() {
    return this.db.prepare(this.sql);
  }
  async all<T>() {
    return { results: this.stmt().all(...(this.v as never[])) as T[] };
  }
  async first<T>() {
    return (this.stmt().get(...(this.v as never[])) as T | undefined) ?? null;
  }
  async run() {
    return { meta: { changes: Number(this.stmt().run(...(this.v as never[])).changes) } };
  }
}

export class D1Gia implements D1 {
  db = new DatabaseSync(':memory:');
  prepare(sql: string) {
    return new LenhGia(this.db, sql);
  }
  /** Như D1: cả lô chạy trong một giao dịch, lỗi thì không ghi gì. */
  async batch(lenh: D1Lenh[]) {
    this.db.exec('BEGIN');
    try {
      const kq = [];
      for (const l of lenh) kq.push(await l.run());
      this.db.exec('COMMIT');
      return kq;
    } catch (e) {
      this.db.exec('ROLLBACK');
      throw e;
    }
  }
}
