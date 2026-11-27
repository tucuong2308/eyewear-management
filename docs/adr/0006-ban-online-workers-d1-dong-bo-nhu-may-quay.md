# Bản online: Cloudflare Workers + D1, đồng bộ với Sheet như một Máy quầy thứ hai

Thay ADR 0002 (bị loại vì Apps Script chậm 3 giây mỗi lần gọi). Bản online là một Cloudflare Worker phục vụ cả giao diện (static assets) lẫn API `/api/*`, dữ liệu chính trong D1. Worker nói chuyện với Google Sheet bằng đúng giao kèo đồng bộ của Máy quầy (ADR 0003, `src/core/dong-bo.ts`): mỗi lần lưu thì đẩy các ô chờ lên Sheet chạy ngầm sau khi đã trả lời người dùng (`waitUntil`); kéo các ô đổi từ Sheet về mỗi phút (Cron Trigger) và khi có yêu cầu mà lần kéo trước đã lâu. Exe, bản online và người sửa thẳng trên Sheet đều gặp nhau ở Sheet.

API dùng chung một mã với exe (`src/server/api.ts`, nhận `Request` trả `Response`); chỉ khác kho dữ liệu: exe dùng file Excel (ADR 0004), online dùng D1 (`src/online/kho-d1.ts`).

## Considered Options

- Cloudflare Pages + Pages Functions như ADR 0002 định: Cloudflare nay khuyên dùng Workers có static assets cho dự án mới; cùng gói miễn phí, một file cấu hình.
- Ghi thẳng Sheet (ADR 0002): bị loại, p90 3,5 giây.
- D1 làm chính, chỉ sao lưu sang Sheet mỗi đêm: Sheet chậm tới một ngày và không nhận được thay đổi từ exe.

## Consequences

- Giao diện online phản hồi theo tốc độ D1 (vài chục ms), không chờ Google.
- Thay đổi giữa bản online và Máy quầy thấy nhau sau tối đa khoảng 1–2 phút (mỗi bên kéo theo chu kỳ của mình). Trùng ô thì bên đẩy sau thắng.
- Bí mật (URL Web App, Khóa Máy quầy, mật khẩu đăng nhập) là Worker secret, không nằm trong mã hay trong trình duyệt.
- Tài khoản đăng nhập online lấy từ secret, chưa đọc từ tab Cài đặt (#13).
- Gói miễn phí giới hạn CPU mỗi yêu cầu; mỗi API đọc toàn bộ đơn từ D1 nên khi dữ liệu lớn cần chuyển lọc vào SQL.
