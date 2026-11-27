# Bản exe chạy web local trên máy quầy, dữ liệu local thắng khi đồng bộ

Cửa hàng cần làm việc được cả khi mất Internet. Ngoài bản web online (ADR 0002), có một bản exe chạy trên đúng một Máy quầy: exe tự khởi động cùng Windows, chạy một máy chủ web local, lưu dữ liệu vào file trên máy, và các thiết bị khác trong cửa hàng vào nó qua Wi-Fi. Khi có mạng, exe đẩy các ô đã sửa ở local lên Google Sheet; nếu cùng một ô bị sửa ở cả hai nơi thì giá trị local ghi đè, không có trạng thái xung đột. Sau đó exe kéo về những thay đổi khác từ Sheet.

## Consequences

- Một sửa đổi trên bản web online có thể bị ghi đè lặng lẽ nếu Máy quầy đang mất mạng và cũng sửa đúng ô đó. Đây là đánh đổi đã chấp nhận để giữ cho việc đồng bộ đơn giản.
- Chỉ đúng một Máy quầy được chạy exe; chạy exe trên máy thứ hai sẽ phá vỡ quy tắc "local thắng".
