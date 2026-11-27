// Dữ liệu trong test là giả; dữ liệu Bệnh nhân thật không bao giờ nằm trong repo.
import { describe, expect, it } from 'vitest';
import { DANH_DAU_NGUON, chuyenDong, type GiaTriO } from '../src/core/nhap-thang-11.js';

const ngay = (s: string) => new Date(`${s}T00:00:00Z`);

/** Một dòng sheet TỔNG (cột A..X) với giá trị mặc định hợp lý, ghi đè theo tên cột. */
function dong(ghiDe: Partial<Record<string, GiaTriO>> = {}): GiaTriO[] {
  const mau: Record<string, GiaTriO> = {
    phanHoi: 'TÍCH CỰC', ten: 'Nguyễn Văn Giả', tuoi: 30, sdt: '0900000000', mp: '-1,25/-0,50*180', mt: -2.5, add: null,
    hang: 'FANO', loai: 'FANO 1,61', kinhSan: false, kyGui: true, kinhDat: false, datDanh: false,
    ngayDat: ngay('2026-11-03'), ngayHen: null, ttTrong: 'ĐÃ CÓ', ttKinh: 'ĐÃ TRẢ',
    shipTime: null, diaChi: null, tuVan: 'NV A', cat: 'NV B', ghiChu: null, maCu: 'cu:1', doneCu: false,
  };
  const g = { ...mau, ...ghiDe };
  return Object.keys(mau).map((k) => g[k]);
}

const taoMa = () => 'ma-moi';

describe('Chuyển dữ liệu tháng 11', () => {
  it('chuyển đúng các trường, giữ mã đơn cũ, độ kính giữ nguyên như đang gõ', () => {
    const kq = chuyenDong(dong(), '', taoMa)!;
    expect(kq.don).toMatchObject({
      id: 'cu:1', ten: 'NGUYỄN VĂN GIẢ', tuoi: '30', sdt: '0900000000', mp: '-1,25/-0,50*180', mt: '-2.5',
      hang: 'FANO', loai: 'FANO 1,61', nguon: 'Ký gửi', ngayDat: '2026-11-03', ngayHen: '',
      ttTrong: 'Đã có', ttKinh: 'Đã trả', phanHoi: 'Tốt', tuVan: 'NV A', cat: 'NV B', thungRac: false,
    });
    expect(kq.nhanVien).toEqual(['NV A', 'NV B']);
    expect(kq.canhBao).toEqual([]);
  });

  it('TÍCH CỰC → Tốt, SỰ CỐ → Sự cố; tình trạng đổi sang cách viết mới', () => {
    expect(chuyenDong(dong({ phanHoi: 'SỰ CỐ' }), '', taoMa)!.don.phanHoi).toBe('Sự cố');
    const k = chuyenDong(dong({ ttKinh: 'ĐÃ CẮT - CHƯA TRẢ', ttTrong: 'ĐÃ ĐẶT - ĐANG GIAO' }), '', taoMa)!.don;
    expect([k.ttKinh, k.ttTrong]).toEqual(['Đã cắt – chưa trả', 'Đã đặt – đang giao']);
    expect(chuyenDong(dong({ ttKinh: 'SHIP' }), '', taoMa)!.don.ttKinh).toBe('Ship');
  });

  it('tick nhiều nguồn hoặc không tick: để trống Nguồn tròng và đánh dấu cần kiểm tra', () => {
    const nhieu = chuyenDong(dong({ kinhSan: true, kyGui: true, ghiChu: 'một mắt ký gửi' }), '', taoMa)!;
    expect(nhieu.don.nguon).toBe('');
    expect(nhieu.don.ghiChu).toBe(`${DANH_DAU_NGUON} một mắt ký gửi`);
    expect(nhieu.canhBao).toEqual(['tick 2 nguồn tròng']);
    const khong = chuyenDong(dong({ kyGui: false }), '', taoMa)!;
    expect(khong.don.nguon).toBe('');
    expect(khong.canhBao).toEqual(['không tick nguồn tròng']);
  });

  it('tuổi không phải số thì để trống; Ngày đặt trống thì lấy từ sheet ngày', () => {
    expect(chuyenDong(dong({ tuoi: ',' }), '', taoMa)!.don.tuoi).toBe('');
    const kq = chuyenDong(dong({ ngayDat: null }), '2026-11-07', taoMa)!;
    expect(kq.don.ngayDat).toBe('2026-11-07');
    expect(kq.canhBao).toEqual(['Ngày đặt lấy từ sheet ngày']);
  });

  it('bỏ dòng trống và dòng ví dụ; không có mã cũ thì tạo mã mới', () => {
    expect(chuyenDong(dong({ ten: null }), '', taoMa)).toBeNull();
    expect(chuyenDong(dong({ ten: 'VD: PHAN MINH KHÔI' }), '', taoMa)).toBeNull();
    expect(chuyenDong(dong({ maCu: null }), '', taoMa)!.don.id).toBe('ma-moi');
  });

  it('ô ngày giờ ở cột thời gian ship đổi thành dd/mm', () => {
    expect(chuyenDong(dong({ shipTime: ngay('2026-11-18') }), '', taoMa)!.don.shipTime).toBe('18/11');
  });
});
