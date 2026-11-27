// Google Sheet giả trong bộ nhớ, đóng vai Apps Script trong test đồng bộ.
import type { KenhSheet, ThayDoiO } from '../src/core/dong-bo.js';

export class SheetGia implements KenhSheet {
  /** false = mất mạng: mọi lời gọi ném lỗi. */
  coMang = true;
  /** Mỗi Đơn kính một dòng: mã đơn → các ô. */
  dong = new Map<string, Record<string, string>>();
  private nhatKy: { rev: number; o: ThayDoiO }[] = [];
  private rev = 0;

  async day(thayDoi: ThayDoiO[]) {
    this.kiemTraMang();
    for (const o of thayDoi) this.ghi(o);
  }

  async keo(moc: number) {
    this.kiemTraMang();
    return { thayDoi: this.nhatKy.filter((x) => x.rev > moc).map((x) => x.o), moc: this.rev };
  }

  /** Ai đó sửa trên Sheet hoặc trên bản web online. */
  suaTrenSheet(id: string, truong: ThayDoiO['truong'], giaTri: string) {
    this.ghi({ id, truong, giaTri });
  }

  o(id: string, truong: string) {
    return this.dong.get(id)?.[truong];
  }

  private ghi(o: ThayDoiO) {
    const d = this.dong.get(o.id) ?? {};
    d[o.truong] = o.giaTri;
    this.dong.set(o.id, d);
    this.nhatKy.push({ rev: ++this.rev, o });
  }

  private kiemTraMang() {
    if (!this.coMang) throw new Error('Mất mạng (Sheet giả)');
  }
}
