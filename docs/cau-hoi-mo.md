# Câu hỏi mở và quyết định đã chốt

## Đã chốt (chủ cửa hàng, 2026-11-27)

- **Định dạng độ kính (MP, MT, ADD)**: giữ gõ tự do như hiện tại.
- **Trường bắt buộc**: Tên, Tuổi, SĐT, MP, MT, Hãng, Loại tròng, Nguồn tròng, Ngày đặt, Ngày hẹn, Tình trạng tròng, Tình trạng kính. Đơn kính thiếu trường nào thì ô đó luôn tô đỏ ở mọi nơi đơn hiển thị, và không Hoàn thành được. Sửa ở đâu thì mọi nơi cập nhật theo.
- **Sự cố**: không có quy trình riêng. Phản hồi = Sự cố đưa đơn sang trang Sự cố; nhân viên tự tạo Đơn kính mới để làm lại.

## Còn mở

- **Tốc độ Apps Script**: đo thử (1.000 đơn giả, mỗi thao tác 20 lần) trước khi chốt ADR 0002. Tiêu chí là tốc độ người dùng cảm nhận: tải trang lần đầu ≤ 2 giây; lưu/sửa cập nhật màn hình ngay, ghi Sheet chạy ngầm có báo "Đang lưu… / Đã lưu ✓". Không đạt thì chuyển sang phương án dự phòng.
