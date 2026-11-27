# Sổ Đơn Kính

Web app quản lý Đơn kính của cửa hàng, thay cho file Google Sheets theo tháng. Thuật ngữ: [GLOSSARY.md](GLOSSARY.md). Quyết định kiến trúc: [docs/adr/](docs/adr/). Spec: issue #1.

## Yêu cầu

- Node.js 22 trở lên.

## Chạy thử trên máy (chế độ dev của exe)

```sh
npm install
npm run dev
```

Mở http://localhost:8080. Dữ liệu lưu ở file Excel `data/So-don-kinh.xlsx`, bản sao hằng ngày ở `data/Sao lưu` (đã nằm trong `.gitignore`). Đổi cổng hoặc thư mục dữ liệu bằng biến môi trường `PORT` và `DATA_DIR`.

**Đăng nhập:** lần chạy đầu tiên tạo `data/config.local.json` với tài khoản `cuahang` và một mật khẩu ngẫu nhiên, in ra màn hình. Đổi tên đăng nhập hoặc mật khẩu bằng cách sửa file đó rồi khởi động lại. File này không bao giờ được commit.

## Đóng gói exe cho Máy quầy

```sh
npm run build:exe    # → dist/exe/SoDonKinh.exe (một file, không cần cài Node)
```

Trên Máy quầy, chép `SoDonKinh.exe` vào một thư mục cố định (ví dụ `C:\SoDonKinh`) rồi chạy một lần:

```sh
SoDonKinh.exe --cai-dat
```

Lệnh này tạo lối tắt trong thư mục Startup để exe tự chạy cùng Windows, mở cổng 8080 trên Windows Firewall cho mạng riêng (Windows sẽ hỏi quyền quản trị), rồi mở app. Lần chạy đầu tiên mở Notepad với file cấu hình chứa mật khẩu ngẫu nhiên để đổi.

- Bấm đúp `SoDonKinh.exe`: mở app (máy chủ chạy ngầm nếu chưa chạy).
- Biểu tượng ở khay hệ thống: bấm đúp hoặc "Mở Sổ Đơn Kính" để mở app, "Thoát" để tắt máy chủ.
- Đóng trình duyệt không làm dừng máy chủ; chỉ một máy chủ chạy tại một thời điểm.
- **Dữ liệu** (ADR 0004): file Excel `Desktop\Sổ Đơn Kính\So-don-kinh.xlsx`. Mọi thay đổi trong app ghi thẳng vào file này.
  - Sửa được ngay trong Excel: sửa ô, thêm dòng mới (app tự cấp Mã đơn), rồi bấm Lưu; app đọc lại và đồng bộ các ô đổi lên Google Sheet. Xóa hẳn một dòng thì đơn đó vào Thùng rác. Đừng đổi tên cột hay sửa cột Mã đơn.
  - **Trong lúc file đang mở trong Excel, app không lưu được** và báo "Đóng Excel rồi thử lại". Xem thì vẫn được.
  - Bản sao hằng ngày trong `Desktop\Sổ Đơn Kính\Sao lưu` (ghi đè trong ngày, giữ 30 bản).
- Cấu hình và nhật ký: `%LOCALAPPDATA%\SoDonKinh`.
- Gỡ tự chạy và quy tắc tường lửa: `SoDonKinh.exe --go-cai-dat`.

## Bản online (Cloudflare Workers + D1)

Địa chỉ: https://so-don-kinh.hidden-gems.workers.dev (ADR 0006). Cùng giao diện và API với exe; dữ liệu trong Cloudflare D1, đồng bộ với Google Sheet như một Máy quầy thứ hai (đẩy ngầm sau mỗi lần lưu, kéo về mỗi phút).

```sh
npx wrangler login          # một lần
npm run deploy:online       # build giao diện rồi triển khai
npx wrangler secret put SHEET_KHOA # đổi khóa Máy quầy (tương tự SHEET_URL; TEN_DANG_NHAP, MAT_KHAU chỉ dùng khi chưa kéo được tài khoản từ Sheet)
npx wrangler tail           # xem nhật ký đang chạy
```

**Đổi tên đăng nhập / mật khẩu (cả exe lẫn online): sửa tab Cài đặt của Google Sheet.** Sau lần đồng bộ kế tiếp (khoảng 1 phút) tài khoản mới có hiệu lực và mọi thiết bị bị đăng xuất. App chỉ lưu mật khẩu dạng băm. Bí mật (URL Web App, Khóa Máy quầy) là Worker secret, không nằm trong repo hay trong trình duyệt.

## Chuyển dữ liệu tháng 11/2026

Tải file Google Sheets cũ "DANH SÁCH KÍNH 11/2026" về dạng .xlsx (Tệp → Tải xuống → Microsoft Excel), rồi:

```sh
npm run nhap-thang-11 -- "đường/dẫn/file.xlsx" --thu                                # chỉ báo cáo, không ghi
npm run nhap-thang-11 -- "đường/dẫn/file.xlsx"                                     # nhập vào Desktop\Sổ Đơn Kính\So-don-kinh.xlsx
```

Đóng file So-don-kinh.xlsx trong Excel trước khi chạy; nhập vào file khác bằng `--file <đường dẫn>`. Chạy lại không nhập trùng. Đơn có nguồn tròng không rõ được ghi `[KIỂM TRA NGUỒN TRÒNG]` ở đầu Ghi chú. Các đơn được ghi chờ đẩy nên tự lên Google Sheet khi bật đồng bộ. **Không commit file Excel** (dữ liệu Bệnh nhân thật).

## Kiểm thử

```sh
npm test          # test qua API của exe, mỗi test dùng một file Excel tạm
npm run typecheck
```

## Cấu trúc

- `src/core`: quy tắc Đơn kính dùng chung cho giao diện, exe và Apps Script. Thuần, không đụng DOM, lưu trữ hay mạng.
- `src/server`: máy chủ web của exe (API Đơn kính + phục vụ giao diện) và kho dữ liệu là file Excel (`kho-excel.ts`).
- `src/server/api.ts`: API dùng chung cho exe và bản online.
- `src/online`: bản online (Worker, kho D1).
- `src/web`: giao diện.
- `test`: test qua API của exe.
- `prototype/` (chỉ trên nhánh `prototype/giao-dien-flow`): bản thử giao diện.

**Repo public: không commit dữ liệu Bệnh nhân thật.**
