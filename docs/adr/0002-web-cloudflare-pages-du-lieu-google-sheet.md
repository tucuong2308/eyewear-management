---
status: rejected
---

# Web trên Cloudflare Pages, dữ liệu lưu thẳng trong Google Sheet

Cửa hàng lo nhất là mất thông tin khách hàng và muốn app chạy lâu dài, miễn phí, không cần ai bảo trì. Chúng ta đặt giao diện web trên Cloudflare Pages và lưu mọi dữ liệu trực tiếp vào một Google Sheet qua một Apps Script làm cầu nối: mỗi lần Lưu là ghi vào Sheet ngay, có Lịch sử phiên bản của Google và bản sao file mỗi đêm. Trạng thái "proposed" cho tới khi đo tốc độ: giao diện phải phản hồi mọi thao tác dưới 0,5 giây (chủ cửa hàng chốt 2026-11-27), nên nếu p90 của tải danh sách từ Apps Script từ 500 ms trở lên thì phải đổi giải pháp. Lưu chạy ngầm nên không tính.

## Considered Options

- Supabase gói Free: tự tạm dừng sau 1 tuần không hoạt động, không có sao lưu tự động.
- Vercel gói Hobby: điều khoản cấm dùng thương mại.
- Cloudflare Workers + D1, sao lưu sang Sheet mỗi đêm: nhanh, nhưng có khoảng thời gian dữ liệu mới chưa có trong bản sao lưu. Đây là phương án dự phòng nếu Apps Script quá chậm, khi đó chuyển sang ghi sang Sheet sau mỗi lần lưu thay vì mỗi đêm.
- Apps Script Web App thuần: giao diện chạy trong khung trang của Google, kém mượt trên điện thoại.

## Kết quả đo (2026-11-27): không đạt

Sheet thử 1.000 Đơn kính giả (5.000 dòng nhật ký), Web App Apps Script thật, mỗi thao tác 20 lần, đo từ máy dev ở Việt Nam (`npm run do-toc-do`):

| Thao tác | Trung vị | p90 | Chậm nhất |
|---|---|---|---|
| Tải danh sách | 2.972 ms | 3.547 ms | 3.950 ms |
| Lưu 1 ô | 2.946 ms | 3.864 ms | 5.090 ms |

Tải danh sách gấp khoảng 7 lần mốc 500 ms. Lưu một ô cũng tốn gần 3 giây, nên phần chậm nằm ở chi phí cố định của mỗi lần gọi Web App Apps Script chứ không ở code xử lý: tối ưu script không kéo về được 0,5 giây.

Vì vậy bản online **không** đọc/ghi thẳng Google Sheet. Bản online dùng phương án dự phòng: Cloudflare Workers + D1 làm dữ liệu chính, mỗi lần lưu ghi tiếp sang Sheet chạy ngầm (thay vì mỗi đêm), để Sheet vẫn là bản sao lưu gần như tức thời. Quyết định chi tiết ghi ở một ADR mới khi làm #15.

Apps Script vẫn dùng được cho đồng bộ của Máy quầy (#14): đồng bộ chạy ngầm 30 giây một lần, người dùng không phải chờ.
