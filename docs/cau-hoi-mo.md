# Câu hỏi mở và quyết định đã chốt

## Đã chốt (chủ cửa hàng, 2026-11-27)

- **Định dạng độ kính (MP, MT, ADD)**: giữ gõ tự do như hiện tại.
- **Trường bắt buộc**: không có trường nào bắt buộc (chốt lại 2026-11-27, thay quyết định trước). Ô trống của Tên, Tuổi, SĐT, MP, MT, Hãng, Loại tròng, Nguồn tròng, Ngày đặt, Ngày hẹn, Tình trạng tròng, Tình trạng kính luôn tô đỏ ở mọi nơi đơn hiển thị để nhắc, nhưng không chặn lưu và không chặn Hoàn thành. Sửa ở đâu thì mọi nơi cập nhật theo.
- **Sự cố**: không có quy trình riêng. Phản hồi = Sự cố đưa đơn sang trang Sự cố; nhân viên tự tạo Đơn kính mới để làm lại.
- **Tốc độ**: cả bản online lẫn bản nội bộ (exe Máy quầy), giao diện phải phản hồi mọi thao tác trong **dưới 0,5 giây**. Lưu/sửa cập nhật màn hình ngay, ghi Sheet chạy ngầm có báo "Đang lưu… / Đã lưu ✓".

## Còn mở

- **Tốc độ Apps Script**: đo thử (1.000 đơn giả, mỗi thao tác 20 lần) trước khi chốt ADR 0002. Đạt khi p90 của "tải danh sách" dưới 500 ms (đây là thao tác người dùng phải chờ; "lưu 1 ô" chạy ngầm nên chỉ ghi lại để tham khảo). Không đạt thì chuyển sang phương án dự phòng.
