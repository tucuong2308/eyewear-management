// Giao kèo đồng bộ giữa exe trên Máy quầy và Google Sheet (ADR 0003).
// Apps Script (#13) cài đặt phía Sheet; exe cài đặt phía Máy quầy; test dùng một Sheet giả.
import { TRUONG_SUA_DUOC, type TruongSuaDuoc } from './don-kinh.js';

/** Các ô được đồng bộ: mọi trường sửa được, cộng cờ Thùng rác ('1' hoặc ''). */
export type TruongDongBo = TruongSuaDuoc | 'thungRac';
export const TRUONG_DONG_BO: readonly TruongDongBo[] = [...TRUONG_SUA_DUOC, 'thungRac'];

/** Một ô của một Đơn kính. Đơn chưa có trên Sheet thì Sheet tạo dòng mới theo mã đơn. */
export interface ThayDoiO {
  id: string;
  truong: TruongDongBo;
  giaTri: string;
}

export interface KenhSheet {
  /** Ghi các ô lên Sheet. Ô trùng thì giá trị gửi lên ghi đè (local thắng). Lỗi mạng thì ném lỗi. */
  day(thayDoi: ThayDoiO[]): Promise<void>;
  /** Các ô đã đổi trên Sheet sau mốc `moc`; `moc` mới để lần sau hỏi tiếp. Lần đầu dùng mốc 0. */
  keo(moc: number): Promise<{ thayDoi: ThayDoiO[]; moc: number }>;
}

export const laTruongDongBo = (s: string): s is TruongDongBo => (TRUONG_DONG_BO as readonly string[]).includes(s);
