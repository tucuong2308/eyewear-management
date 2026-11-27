---
status: proposed
---

# Web trên Cloudflare Pages, dữ liệu lưu thẳng trong Google Sheet

Cửa hàng lo nhất là mất thông tin khách hàng và muốn app chạy lâu dài, miễn phí, không cần ai bảo trì. Chúng ta đặt giao diện web trên Cloudflare Pages và lưu mọi dữ liệu trực tiếp vào một Google Sheet qua một Apps Script làm cầu nối: mỗi lần Lưu là ghi vào Sheet ngay, có Lịch sử phiên bản của Google và bản sao file mỗi đêm. Trạng thái "proposed" cho tới khi đo tốc độ: nếu một thao tác mất quá 1 giây thì phải đổi giải pháp.

## Considered Options

- Supabase gói Free: tự tạm dừng sau 1 tuần không hoạt động, không có sao lưu tự động.
- Vercel gói Hobby: điều khoản cấm dùng thương mại.
- Cloudflare Workers + D1, sao lưu sang Sheet mỗi đêm: nhanh, nhưng có khoảng thời gian dữ liệu mới chưa có trong bản sao lưu. Đây là phương án dự phòng nếu Apps Script quá chậm, khi đó chuyển sang ghi sang Sheet sau mỗi lần lưu thay vì mỗi đêm.
- Apps Script Web App thuần: giao diện chạy trong khung trang của Google, kém mượt trên điện thoại.
