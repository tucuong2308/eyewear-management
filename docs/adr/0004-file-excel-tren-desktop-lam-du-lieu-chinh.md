# File Excel trên Desktop là nơi lưu dữ liệu chính của Máy quầy

Chủ repo quyết định (2026-11-27): dữ liệu Đơn kính trên Máy quầy nằm trong một file Excel `Desktop\Sổ Đơn Kính\So-don-kinh.xlsx` để nhân viên dễ tìm, mở và sửa, thay cho SQLite ẩn (ADR 0003). Chỉ dùng Excel, không có lớp lưu ẩn: khi file đang mở trong Excel thì app báo "đóng Excel rồi thử lại" và không lưu được thay đổi.

## Consequences

- Mỗi thay đổi ghi lại cả file (ghi file tạm rồi đổi tên) để mất điện giữa chừng không làm hỏng file cũ.
- Sửa thẳng trong Excel rồi Lưu: app phát hiện file đổi và đọc lại; các ô đổi được đưa vào hàng chờ đồng bộ lên Google Sheet.
- Tab ẩn trong cùng file giữ phiên đăng nhập, hàng chờ đồng bộ và trạng thái đồng bộ.
- Rủi ro đã chấp nhận: không lưu được khi file đang mở; file bị xóa hoặc ghi đè nhầm. Giảm nhẹ bằng bản sao hằng ngày trong `Sổ Đơn Kính\Sao lưu` (giữ 30 bản).
