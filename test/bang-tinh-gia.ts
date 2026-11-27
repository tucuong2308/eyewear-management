// Bảng tính trong bộ nhớ thay cho SpreadsheetApp khi test phần xử lý Apps Script.
import type { BangTinh } from '../src/apps-script/xu-ly.js';

export class BangTinhGia implements BangTinh {
  tabs = new Map<string, string[][]>();
  an = new Set<string>();

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
  ghiO(ten: string, hang: number, cot: number, giaTri: string) {
    const t = this.tabs.get(ten)!;
    while (t.length <= hang) t.push([]);
    const h = t[hang]!;
    while (h.length <= cot) h.push('');
    h[cot] = giaTri;
  }
  themHang(ten: string, giaTri: string[]) {
    this.tabs.get(ten)!.push([...giaTri]);
  }
}
