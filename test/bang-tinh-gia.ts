// Bảng tính trong bộ nhớ thay cho SpreadsheetApp khi test phần xử lý Apps Script.
import type { BangTinh } from '../src/apps-script/xu-ly.js';

export class BangTinhGia implements BangTinh {
  tabs = new Map<string, string[][]>();
  an = new Set<string>();
  cotTick = new Map<string, number[]>();
  congThuc = new Map<string, string>();
  /** Mỗi lần ghi (mỗi lần gọi Google thật), để test số lần gọi. */
  lanGhi: { ten: string; hangDau: number; soHang: number }[] = [];

  coTab(ten: string) {
    return this.tabs.has(ten);
  }
  taoTab(ten: string, tieuDe: string[], tuyChon: { an?: boolean; cotTick?: number[] } = {}) {
    this.tabs.set(ten, [[...tieuDe]]);
    if (tuyChon.an) this.an.add(ten);
    if (tuyChon.cotTick) this.cotTick.set(ten, tuyChon.cotTick);
  }
  /** Sửa ô Giá trị của một dòng trong tab Cài đặt (như chủ cửa hàng sửa tay). */
  datCaiDat(tab: string, ten: string, giaTri: string) {
    const h = this.tabs.get(tab)!.find((r) => r[0] === ten)!;
    h[1] = giaTri;
  }
  ghiCongThuc(ten: string, hang: number, cot: number, congThuc: string) {
    this.congThuc.set(`${ten}!${hang},${cot}`, congThuc);
  }
  doc(ten: string) {
    return (this.tabs.get(ten) ?? []).map((h) => [...h]);
  }
  /** Cột bị khóa: tab → các cột. */
  khoa = new Map<string, Set<number>>();

  ghiVung(ten: string, hangDau: number, giaTri: string[][], cotDau = 0) {
    if (!giaTri.length) return;
    this.lanGhi.push({ ten, hangDau, soHang: giaTri.length });
    const t = this.tabs.get(ten)!;
    giaTri.forEach((h, i) => {
      while (t.length <= hangDau + i) t.push([]);
      const dong = t[hangDau + i]!;
      h.forEach((v, j) => {
        while (dong.length < cotDau + j) dong.push('');
        dong[cotDau + j] = v;
      });
    });
  }
  khoaCot(ten: string, cot: number) {
    if (!this.khoa.has(ten)) this.khoa.set(ten, new Set());
    this.khoa.get(ten)!.add(cot);
  }
  themHang(ten: string, hang: string[][]) {
    this.ghiVung(ten, this.tabs.get(ten)!.length, hang);
  }
}
