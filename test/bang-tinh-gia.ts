// Bảng tính trong bộ nhớ thay cho SpreadsheetApp khi test phần xử lý Apps Script.
import type { BangTinh } from '../src/apps-script/xu-ly.js';

export class BangTinhGia implements BangTinh {
  tabs = new Map<string, string[][]>();
  an = new Set<string>();
  /** Mỗi lần ghi (mỗi lần gọi Google thật), để test số lần gọi. */
  lanGhi: { ten: string; hangDau: number; soHang: number }[] = [];

  coTab(ten: string) {
    return this.tabs.has(ten);
  }
  taoTab(ten: string, tieuDe: string[], an = false) {
    this.tabs.set(ten, [[...tieuDe]]);
    if (an) this.an.add(ten);
  }
  doc(ten: string) {
    return (this.tabs.get(ten) ?? []).map((h) => [...h]);
  }
  ghiVung(ten: string, hangDau: number, giaTri: string[][]) {
    if (!giaTri.length) return;
    this.lanGhi.push({ ten, hangDau, soHang: giaTri.length });
    const t = this.tabs.get(ten)!;
    giaTri.forEach((h, i) => {
      while (t.length <= hangDau + i) t.push([]);
      t[hangDau + i] = [...h];
    });
  }
  themHang(ten: string, hang: string[][]) {
    this.ghiVung(ten, this.tabs.get(ten)!.length, hang);
  }
}
