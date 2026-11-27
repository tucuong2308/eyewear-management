# Đưa Apps Script lên Google Sheet

Code Apps Script nằm ở `src/apps-script/`. Phần xử lý (`xu-ly.ts`) có test trên máy; `gas.ts` chỉ nối vào Google.

## Một lần: tạo Sheet và đưa code lên

1. Đăng nhập Google cho `clasp` (mở trình duyệt, bấm **Allow**):

   ```sh
   npx @google/clasp login
   ```

2. Tạo Google Sheet mới "Sổ Đơn Kính" kèm Apps Script gắn với nó:

   ```sh
   cd apps-script
   npx @google/clasp create --type sheets --title "Sổ Đơn Kính" --rootDir dist
   cd ..
   ```

   Lệnh này tạo `apps-script/.clasp.json` (không commit).

3. Đóng gói rồi đưa code lên:

   ```sh
   npm run build:apps-script
   cd apps-script && npx @google/clasp push --force && cd ..
   ```

4. Mở Apps Script (`cd apps-script && npx @google/clasp open-script`), chọn hàm **caiDat**, bấm **Run**, cấp quyền. Hàm này:
   - tạo các tab Đơn kính, Danh sách, Cài đặt và tab ẩn \_Nhật ký;
   - tạo **khóa Máy quầy** và mật khẩu ngẫu nhiên trong tab Cài đặt;
   - đặt lịch sao lưu 23:00 hằng đêm vào thư mục Drive "Sổ Đơn Kính - sao lưu" (giữ 30 bản).

5. Triển khai Web App: **Deploy → New deployment → Web app**, Execute as: *Me*, Who has access: *Anyone*. Chép **Web app URL**.

   Web App mở cho mọi người nhưng mọi yêu cầu phải mang đúng khóa Máy quầy; không có khóa thì bị từ chối.

## Đo tốc độ (#12)

Trên một Sheet **thử** (không phải Sheet thật của cửa hàng):

```sh
npm run do-toc-do -- "<Web app URL>" "<Khóa Máy quầy>" --tao-du-lieu
```

In trung vị và p90 của "tải danh sách" (1.000 đơn) và "lưu 1 ô". Đạt khi p90 của "tải danh sách" dưới 500 ms. Ghi kết quả vào ADR 0002.

## Nối Máy quầy với Sheet

Thêm vào `config.local.json` trong thư mục dữ liệu của exe (`%LOCALAPPDATA%\SoDonKinh`), rồi khởi động lại exe:

```json
{
  "taiKhoan": { "ten": "cuahang", "matKhau": "…" },
  "sheet": { "url": "<Web app URL>", "khoa": "<Khóa Máy quầy trong tab Cài đặt>" }
}
```

Máy quầy đồng bộ 30 giây một lần; kết quả ghi trong `so-don-kinh.log`.

## Cập nhật code về sau

```sh
npm run build:apps-script
cd apps-script && npx @google/clasp push --force
```

Rồi **Deploy → Manage deployments → Edit → Version: New version** để Web App dùng code mới (giữ nguyên URL).

## Lưu ý

- Mọi ô ở các tab được đặt định dạng chữ, để Sheets không tự đổi ngày `2026-11-30` hay số điện thoại `0912…`.
- Sửa thẳng ô ở tab Đơn kính được ghi nhật ký (trigger `onEdit`) để Máy quầy kéo về. Không sửa cột Mã đơn.
- Không xóa hay sắp xếp lại dòng ở tab Đơn kính và tab \_Nhật ký: mốc đồng bộ dựa vào thứ tự dòng.
