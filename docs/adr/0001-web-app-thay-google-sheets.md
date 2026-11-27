# Web app với một cơ sở dữ liệu thay cho Google Sheets

Cửa hàng đang quản lý đơn kính bằng Google Sheets: mỗi ngày một sheet, cộng ba sheet tổng hợp (KÍNH HẸN, SỰ CỐ, TỔNG) được một Apps Script đồng bộ hai chiều qua sheet ẩn `__KINH_DONG_BO_V23`. Cách này hay lệch dữ liệu (đơn đã trả vẫn nằm ở KÍNH HẸN, nguy cơ trùng dòng ở TỔNG). Chúng ta làm web app lưu mọi Đơn kính trong một cơ sở dữ liệu duy nhất; "trang ngày", "kính hẹn", "sự cố", "tổng" chỉ là các cách lọc trên cùng danh sách, nên sửa ở đâu cũng là sửa một bản ghi và không thể bị nhân đôi.

## Considered Options

- Giữ Google Sheets, viết lại Apps Script: miễn phí, nhân viên quen tay, nhưng đồng bộ nhiều bản sao giữa các sheet là nguồn lỗi gốc.
