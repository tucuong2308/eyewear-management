# Bảng TỔNG giống file mẫu cũ; KÍNH HẸN, SỰ CỐ là tab lọc

Chủ cửa hàng muốn Google Sheet và file Excel trên Máy quầy trông giống file mẫu "Gốc Danh sách kính" mà nhân viên đã quen (2026-11-27). Tab chính tên **TỔNG**, cột A–V đúng thứ tự mẫu cũ, Nguồn tròng là 4 ô tick (KÍNH SẴN, KÝ GỬI, KÍNH ĐẶT, ĐẶT ĐÁNH). Thêm ở cuối: NGUỒN KHÁC (nguồn thêm qua "Khác…" không có ô tick), THÙNG RÁC, MÃ ĐƠN. **KÍNH HẸN** và **SỰ CỐ** là tab chỉ để xem, tự lọc từ TỔNG bằng công thức FILTER/SORT, cùng quy tắc với app. Bố cục nằm một chỗ: `src/core/bo-cuc.ts`.

Vẫn giữ ADR 0001: mỗi Đơn kính một dòng ở TỔNG; không chép đơn sang sheet ngày, KÍNH HẸN hay SỰ CỐ như file cũ, nên không lệch và không nhân đôi.

## Considered Options

- Giống hệt file cũ (sheet theo ngày, KÍNH HẸN, SỰ CỐ, TỔNG là các bản chép riêng): bị loại, chính là nguyên nhân lệch và nhân đôi đơn mà app sinh ra để chữa.
- Chỉ đổi cột, không có tab lọc: ít việc hơn nhưng nhân viên mất hai tab quen dùng.

## Consequences

- Đọc theo tiêu đề cột, không theo vị trí: đổi thứ tự cột vẫn đúng; nhận cả tiêu đề của mẫu cũ ("TÌNH TRẠNG MĂT", "ADD \n(ĐA TRÒNG)") và tiêu đề cũ của app.
- Tick một ô nguồn trên Sheet thì các ô nguồn khác tự bỏ tick (mỗi đơn một nguồn); trong Excel, ô được tick đầu tiên tính là nguồn.
- File Excel trên Máy quầy chỉ có TỔNG (không có tab lọc): công thức FILTER cần Excel 365/2021, chưa biết Máy quầy dùng bản nào.
- Giá trị trong ô theo app (ví dụ "Đã đặt – đang giao"), không theo chữ in hoa của file cũ.
