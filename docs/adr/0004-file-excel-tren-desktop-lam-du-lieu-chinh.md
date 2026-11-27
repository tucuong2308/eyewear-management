# File Excel trên Desktop là nơi lưu dữ liệu chính của Máy quầy

Chủ repo quyết định (2026-11-27): dữ liệu Đơn kính trên Máy quầy nằm trong một file Excel `Desktop\Sổ Đơn Kính\So-don-kinh.xlsx` để nhân viên dễ tìm, mở và sửa, thay cho SQLite ẩn (ADR 0003). Chỉ dùng Excel, không có lớp lưu ẩn: khi file đang mở trong Excel thì app báo "đóng Excel rồi thử lại" và không lưu được thay đổi.

## Consequences

- Mỗi thay đổi ghi lại cả file (ghi file tạm rồi đổi tên) để mất điện giữa chừng không làm hỏng file cũ.
- Sửa thẳng trong Excel rồi Lưu: app phát hiện file đổi và đọc lại; các ô đổi được đưa vào hàng chờ đồng bộ lên Google Sheet.
- Tab ẩn trong cùng file giữ phiên đăng nhập, hàng chờ đồng bộ và trạng thái đồng bộ.
- Rủi ro đã chấp nhận: không lưu được khi file đang mở; file bị xóa hoặc ghi đè nhầm. Giảm nhẹ bằng bản sao hằng ngày trong `Sổ Đơn Kính\Sao lưu` (giữ 30 bản).

## Chi tiết khi làm (#38)

- Dòng bị xóa hẳn trong Excel được coi là chuyển vào Thùng rác (ghi lại vào file, đồng bộ lên Sheet), không mất đơn.
- Dòng mới không có Mã đơn được cấp mã; nếu file còn mở nên chưa ghi được mã, các lần Lưu sau giữ đúng mã đó theo thứ tự dòng.
- Đọc theo tiêu đề cột, nên đổi thứ tự cột vẫn đúng; cột lạ do nhân viên thêm sẽ mất ở lần ghi sau. Ngày gõ kiểu `30/11/2026` hay ngày Excel tự đổi được đưa về `2026-11-30`.
- Phiên đăng nhập và trạng thái đồng bộ không chặn khi file đang mở: giữ trong bộ nhớ, ghi cùng lần lưu sau. Đăng nhập vẫn được khi đang mở file.
- Sửa file trong lúc exe không chạy thì app nhận dữ liệu mới khi mở, nhưng chỉ dòng mới (chưa có Mã đơn) được đưa lên Sheet; ô sửa trên dòng cũ không được đồng bộ vì không còn bản trước để so.
- Tốc độ lưu một ô (ghi lại cả file, máy dev): 1.500 đơn 157 ms, 3.000 đơn 283 ms, 6.000 đơn 574 ms. Giao diện hiện giá trị ngay và lưu chạy ngầm nên vẫn dưới 0,5 giây; khi file vượt khoảng 4.000 đơn (khoảng 3 năm) thì cần tách đơn cũ sang file lưu trữ theo năm.
