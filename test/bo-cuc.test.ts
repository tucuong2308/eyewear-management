import { describe, expect, it } from 'vitest';
import { COT_TONG, TIEU_DE_TONG, chuCot, congThucChamPhay, donTuHang, hangTheoTieuDe, tabXem } from '../src/core/bo-cuc.js';
import { donMoi } from '../src/core/don-kinh.js';

const don = { ...donMoi('ma-1', 'AN', '2026-11-27'), sdt: '0912', nguon: 'Kính đặt', ngayHen: '2026-11-30' };

describe('Bố cục bảng TỔNG giống file mẫu', () => {
  it('cột A–V đúng thứ tự mẫu cũ, thêm NGUỒN KHÁC, THÙNG RÁC, MÃ ĐƠN ở cuối', () => {
    expect(TIEU_DE_TONG).toEqual([
      'PHẢN HỒI', 'TÊN', 'TUỔI', 'SDT LIÊN HỆ', 'MP', 'MT', 'ADD (ĐA TRÒNG)', 'HÃNG KÍNH', 'LOẠI KÍNH',
      'KÍNH SẴN', 'KÝ GỬI', 'KÍNH ĐẶT', 'ĐẶT ĐÁNH', 'NGÀY ĐẶT', 'NGÀY HẸN', 'TÌNH TRẠNG MẮT', 'TÌNH TRẠNG KÍNH',
      'THỜI GIAN ĐẶT SHIP (NẾU ĐẶT SHIP)', 'ĐỊA CHỈ (NẾU ĐẶT SHIP)', 'NGƯỜI TƯ VẤN - ĐẶT KÍNH', 'NGƯỜI CẮT KÍNH', 'GHI CHÚ',
      'NGUỒN KHÁC', 'THÙNG RÁC', 'MÃ ĐƠN',
    ]);
  });

  it('Nguồn tròng là 4 ô tick; nguồn thêm qua "Khác…" vào NGUỒN KHÁC; đọc lại ra đúng đơn', () => {
    const hang = hangTheoTieuDe(TIEU_DE_TONG, don);
    expect(hang.slice(9, 13)).toEqual(['FALSE', 'FALSE', 'TRUE', 'FALSE']);
    expect(donTuHang(TIEU_DE_TONG, hang)).toEqual(don);

    const khac = { ...don, nguon: 'Mượn tròng', thungRac: true };
    const h2 = hangTheoTieuDe(TIEU_DE_TONG, khac);
    expect(h2.slice(9, 13)).toEqual(['FALSE', 'FALSE', 'FALSE', 'FALSE']);
    expect(h2.slice(-3)).toEqual(['Mượn tròng', 'Có', 'ma-1']);
    expect(donTuHang(TIEU_DE_TONG, h2)).toEqual(khac);
  });

  it('đọc theo tiêu đề: đổi thứ tự cột, tiêu đề xuống dòng/sai chính tả của mẫu cũ, tiêu đề cũ của app đều nhận', () => {
    expect(donTuHang(['MÃ ĐƠN', 'ADD \n(ĐA TRÒNG)', 'TÌNH TRẠNG MĂT', 'KÝ GỬI', 'cột lạ'], ['x', '1.50', 'Đã có', 'TRUE', 'bỏ qua']))
      .toMatchObject({ id: 'x', add: '1.50', ttTrong: 'Đã có', nguon: 'Ký gửi' });
    expect(donTuHang(['Mã đơn', 'Tên', 'Nguồn tròng', 'Tình trạng tròng', 'Thùng rác'], ['y', 'BÌNH', 'Kính sẵn', 'Chưa đặt', 'Có']))
      .toMatchObject({ id: 'y', ten: 'BÌNH', nguon: 'Kính sẵn', ttTrong: 'Chưa đặt', thungRac: true });
  });

  it('cột lạ do nhân viên thêm giữ nguyên giá trị khi ghi lại dòng', () => {
    expect(hangTheoTieuDe(['TÊN', 'CỘT RIÊNG', 'MÃ ĐƠN'], don, ['cũ', 'giữ', 'ma-1'])).toEqual(['AN', 'giữ', 'ma-1']);
  });

  it('tab KÍNH HẸN và SỰ CỐ là công thức lọc từ TỔNG theo đúng cột', () => {
    expect(chuCot(0)).toBe('A');
    expect(chuCot(26)).toBe('AA');
    const [hen, suCo] = tabXem('TỔNG', 'Đã trả', 'Sự cố');
    const cot = (tieuDe: string) => chuCot(TIEU_DE_TONG.indexOf(tieuDe));
    expect(hen!.ten).toBe('KÍNH HẸN');
    expect(hen!.tieuDe.slice(0, 3)).toEqual(['PHẢN HỒI', 'NGÀY HẸN', 'NGÀY ĐẶT']);
    expect(hen!.congThuc).toContain(`'TỔNG'!${cot('NGÀY HẸN')}2:${cot('NGÀY HẸN')}<>""`);
    expect(hen!.congThuc).toContain(`'TỔNG'!${cot('TÌNH TRẠNG KÍNH')}2:${cot('TÌNH TRẠNG KÍNH')}<>"Đã trả"`);
    expect(hen!.congThuc).toContain(`'TỔNG'!${cot('THÙNG RÁC')}2:${cot('THÙNG RÁC')}=""`);
    expect(suCo!.tieuDe).toEqual(TIEU_DE_TONG.slice(0, 22));
    expect(suCo!.congThuc).toContain(`FILTER('TỔNG'!A2:V, 'TỔNG'!A2:A="Sự cố"`);
    expect(COT_TONG).toHaveLength(25);
  });

  it('đổi công thức sang kiểu dấu chấm phẩy cho Sheet đặt vùng Việt Nam', () => {
    expect(congThucChamPhay('=IFERROR(SORT(FILTER({A2:A,B2:B}, C2:C<>"a,b"), 2, TRUE), "")'))
      .toBe(`=IFERROR(SORT(FILTER({A2:A${String.fromCharCode(92)}B2:B}; C2:C<>"a,b"); 2; TRUE); "")`);
  });
});
