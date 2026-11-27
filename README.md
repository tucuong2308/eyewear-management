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
