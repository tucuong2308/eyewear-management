# Sổ Đơn Kính

Web app quản lý Đơn kính của cửa hàng, thay cho file Google Sheets theo tháng. Thuật ngữ: [GLOSSARY.md](GLOSSARY.md). Quyết định kiến trúc: [docs/adr/](docs/adr/). Spec: issue #1.

## Yêu cầu

- Node.js 22.13 trở lên (dùng `node:sqlite` có sẵn trong Node).

## Chạy thử trên máy (chế độ dev của exe)

```sh
npm install
npm run dev
```

Mở http://localhost:8080. Dữ liệu lưu ở `data/so-don-kinh.db` (đã nằm trong `.gitignore`). Đổi cổng hoặc thư mục dữ liệu bằng biến môi trường `PORT` và `DATA_DIR`.

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
- Dữ liệu, cấu hình và nhật ký: `%LOCALAPPDATA%\SoDonKinh`.
- Gỡ tự chạy và quy tắc tường lửa: `SoDonKinh.exe --go-cai-dat`.

## Chuyển dữ liệu tháng 11/2026

Tải file Google Sheets cũ "DANH SÁCH KÍNH 11/2026" về dạng .xlsx (Tệp → Tải xuống → Microsoft Excel), rồi:

```sh
npm run nhap-thang-11 -- "đường/dẫn/file.xlsx" --thu                                # chỉ báo cáo, không ghi
npm run nhap-thang-11 -- "đường/dẫn/file.xlsx" --data "%LOCALAPPDATA%\SoDonKinh"   # nhập vào dữ liệu của exe
```

Chạy lại không nhập trùng. Đơn có nguồn tròng không rõ được ghi `[KIỂM TRA NGUỒN TRÒNG]` ở đầu Ghi chú. Các đơn được ghi chờ đẩy nên tự lên Google Sheet khi bật đồng bộ. **Không commit file Excel hay CSDL** (dữ liệu Bệnh nhân thật).

## Kiểm thử

```sh
npm test          # test qua API của exe, mỗi test dùng một file SQLite tạm
npm run typecheck
```

## Cấu trúc

- `src/core`: quy tắc Đơn kính dùng chung cho giao diện, exe và Apps Script. Thuần, không đụng DOM, lưu trữ hay mạng.
- `src/server`: máy chủ web của exe (API Đơn kính + phục vụ giao diện) và kho SQLite.
- `src/web`: giao diện.
- `test`: test qua API của exe.
- `prototype/` (chỉ trên nhánh `prototype/giao-dien-flow`): bản thử giao diện.

**Repo public: không commit dữ liệu Bệnh nhân thật.**
