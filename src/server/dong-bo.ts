// Đồng bộ Máy quầy ↔ Google Sheet (ADR 0003): đẩy các ô đã sửa ở local (local thắng), rồi kéo các ô khác về.
import type { KenhSheet } from '../core/dong-bo.js';
import { TT_MAT_KHAU_BAM, TT_TEN, type Kho } from './api.js';
import { bamMatKhau, thanhTaiKhoanBam, type TaiKhoan } from './dang-nhap.js';

export class DongBo {
  private dangChay: Promise<void> | null = null;
  private hen: ReturnType<typeof setInterval> | null = null;

  constructor(
    private kho: Kho,
    private kenh: KenhSheet,
    private bayGio: () => number,
    private ghiLog: (s: string) => void = () => {},
    /** Tài khoản cấu hình trên máy: chỉ đăng xuất mọi người khi tab Cài đặt khác tài khoản đang dùng. */
    private taiKhoanMay?: TaiKhoan,
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

  /** Tài khoản trong tab Cài đặt đổi thì dùng tài khoản mới và đăng xuất mọi thiết bị. Ô trống thì bỏ qua. */
  private async capNhatTaiKhoan(ten: string, matKhau: string) {
    if (!ten || !matKhau) return;
    const bam = bamMatKhau(matKhau);
    const tenCu = await this.kho.trangThai(TT_TEN);
    const bamCu = await this.kho.trangThai(TT_MAT_KHAU_BAM);
    if (tenCu === ten && bamCu === bam) return;
    // Tài khoản đang dùng: đã lưu từ Sheet, chưa có thì là tài khoản cấu hình trên máy
    const dangDung = tenCu && bamCu ? { ten: tenCu, matKhauBam: bamCu } : this.taiKhoanMay && thanhTaiKhoanBam(this.taiKhoanMay);
    await this.kho.datTrangThai(TT_TEN, ten);
    await this.kho.datTrangThai(TT_MAT_KHAU_BAM, bam);
    if (dangDung?.ten.trim() === ten && dangDung.matKhauBam === bam) return;
    await this.kho.xoaMoiPhien();
    this.ghiLog('Tài khoản đăng nhập đổi theo tab Cài đặt của Google Sheet: đã đăng xuất mọi thiết bị');
  }

  private async mot() {
    try {
      const cho = await this.kho.choDay();
      if (cho.length) {
        await this.kenh.day(cho.map(({ id, truong, giaTri }) => ({ id, truong, giaTri })));
        await this.kho.xoaChoDay(cho);
      }
      const moc = Number((await this.kho.trangThai('mocKeo')) ?? 0);
      const { thayDoi, moc: mocMoi, taiKhoan } = await this.kenh.keo(moc);
      await this.kho.apDungTuSheet(thayDoi, mocMoi);
      if (taiKhoan) await this.capNhatTaiKhoan(taiKhoan.ten.trim(), taiKhoan.matKhau);
      await this.kho.datTrangThai('lanCuoiThanhCong', String(this.bayGio()));
      await this.kho.datTrangThai('loiCuoi', '');
    } catch (e) {
      const loi = (e as Error).message ?? String(e);
      await this.kho.datTrangThai('loiCuoi', loi).catch(() => {});
      this.ghiLog(`Đồng bộ chưa được: ${loi}`);
    }
  }
}
