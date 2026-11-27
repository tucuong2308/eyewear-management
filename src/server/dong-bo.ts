// Đồng bộ Máy quầy ↔ Google Sheet (ADR 0003): đẩy các ô đã sửa ở local (local thắng), rồi kéo các ô khác về.
import type { KenhSheet } from '../core/dong-bo.js';
import type { KhoExcel } from './kho-excel.js';

export class DongBo {
  private dangChay: Promise<void> | null = null;
  private hen: ReturnType<typeof setInterval> | null = null;

  constructor(
    private kho: KhoExcel,
    private kenh: KenhSheet,
    private bayGio: () => number,
    private ghiLog: (s: string) => void = () => {},
  ) {}

  /** Một lượt đồng bộ. Lỗi (mất mạng…) chỉ ghi lại, không ném ra: lượt sau thử lại. */
  chayMotLan(): Promise<void> {
    // không chạy chồng hai lượt
    this.dangChay ??= this.mot().finally(() => {
      this.dangChay = null;
    });
    return this.dangChay;
  }

  batDau(chuKyMs: number) {
    void this.chayMotLan();
    this.hen = setInterval(() => void this.chayMotLan(), chuKyMs);
    this.hen.unref?.();
  }

  dung() {
    if (this.hen) clearInterval(this.hen);
    this.hen = null;
  }

  private async mot() {
    try {
      const cho = this.kho.choDay();
      if (cho.length) {
        await this.kenh.day(cho.map(({ id, truong, giaTri }) => ({ id, truong, giaTri })));
        await this.kho.xoaChoDay(cho);
      }
      const moc = Number(this.kho.trangThai('mocKeo') ?? 0);
      const { thayDoi, moc: mocMoi } = await this.kenh.keo(moc);
      await this.kho.apDungTuSheet(thayDoi, mocMoi);
      await this.kho.datTrangThai('lanCuoiThanhCong', String(this.bayGio()));
      await this.kho.datTrangThai('loiCuoi', '');
    } catch (e) {
      const loi = (e as Error).message ?? String(e);
      await this.kho.datTrangThai('loiCuoi', loi).catch(() => {});
      this.ghiLog(`Đồng bộ chưa được: ${loi}`);
    }
  }
}
