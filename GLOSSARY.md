# Eyewear management

Quản lý đơn kính của một cửa hàng kính: từ lúc tư vấn, đặt tròng, cắt kính đến khi trả kính cho bệnh nhân.

## Con người

**Bệnh nhân**:
Người đến cửa hàng làm kính (tên, tuổi, số điện thoại). Một bệnh nhân có thể có nhiều Đơn kính.
_Avoid_: Khách hàng, BN, khách

**Nhân viên**:
Người làm ở cửa hàng, có tài khoản đăng nhập; có thể là Người tư vấn hoặc Người cắt của một Đơn kính.
_Avoid_: User, tài khoản

**Quản lý**:
Nhân viên có quyền quản lý danh sách nhân viên và các danh sách lựa chọn.
_Avoid_: Admin

## Đơn kính

**Đơn kính**:
Một lần làm kính cho một Bệnh nhân: độ mắt, tròng, ngày đặt, ngày hẹn, tình trạng và người phụ trách. Mỗi Đơn kính chỉ tồn tại một lần trong hệ thống.
_Avoid_: Dòng, bản ghi, đơn hàng

**Ngày đặt**:
Ngày Đơn kính được tạo ở cửa hàng.

**Ngày hẹn**:
Ngày cửa hàng hẹn Bệnh nhân quay lại lấy kính.

**Kính hẹn**:
Đơn kính có Ngày hẹn và chưa Hoàn thành.
_Avoid_: Đơn hẹn, lịch hẹn

**Nguồn tròng**:
Tròng của Đơn kính lấy từ đâu: Kính sẵn, Ký gửi, Kính đặt, Đặt đánh, hoặc một nguồn khác cửa hàng tự thêm.

**Tình trạng tròng**:
Tròng đã có ở cửa hàng chưa: Chưa đặt, Đã đặt – đang giao, Đã có.
_Avoid_: Tình trạng mắt

**Tình trạng kính**:
Kính đang ở bước nào: Chưa cắt, Đã cắt – chưa trả, Ship, Đã trả.

**Hoàn thành**:
Đơn kính đã giao tới tay Bệnh nhân, tức Tình trạng kính là Đã trả. Không phải một trường riêng.
_Avoid_: Xong, done

**Phản hồi**:
Đánh giá của Bệnh nhân khi nhận kính: Tốt, Không tốt, hoặc Khác.
_Avoid_: Tích cực
