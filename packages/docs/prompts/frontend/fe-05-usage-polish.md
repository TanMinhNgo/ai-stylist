# Prompt FE-05 — Hạn mức, tài khoản, hoàn thiện

**Giao cho:** Claude Code. **Giai đoạn:** 5. **Cần backend:** BE-05.

---

Hiển thị hạn mức theo gói, hoàn thiện phần tài khoản và rà soát chất lượng toàn app trước khi cho người dùng thử.

## Việc cần làm

1. **Hạn mức**
   - Gọi `GET /usage`, hiển thị số lượt còn lại ở Studio.
   - Làm mới sau mỗi lần tạo job và khi job thất bại (được hoàn lượt).
   - Còn ít lượt: nhắc nhẹ. Hết lượt: vô hiệu nút thử đồ và hiển thị ngày làm mới.

2. **Màn hết lượt**
   - Xuất hiện khi nhận `QUOTA_EXCEEDED`.
   - Nội dung: đã dùng hết lượt tháng này, ngày được làm mới, tài khoản đang ở gói nào.
   - Không hiển thị giá, nút mua hay đường dẫn tới trang thanh toán trong app.

3. **Trạng thái gói**
   - Đọc gói từ `GET /usage` làm nguồn chính. Có thể dùng `has({ plan })` của Clerk để ẩn hiện giao diện, nhưng quyền thật do backend quyết định.
   - Tính năng chỉ dành cho gói trả phí hiển thị ở trạng thái khóa kèm giải thích ngắn.
   - Làm mới trạng thái gói khi app quay lại từ nền.

4. **Tài khoản**
   - Tab Hồ sơ: gói hiện tại, lượt đã dùng, quản lý ảnh người mẫu.
   - Xóa tài khoản: xác nhận hai bước, gọi `DELETE /me`, đăng xuất.
   - Liên kết tới điều khoản sử dụng và chính sách quyền riêng tư.

5. **Hoàn thiện**
   - Rà từng màn hình: đủ trạng thái đang tải (skeleton), rỗng, lỗi.
   - Mất mạng: banner thông báo, tự tải lại khi có mạng.
   - `RATE_LIMITED`: thông báo chờ, không tự gửi lại liên tục.
   - Phản hồi xúc giác ở các thao tác chính, chuyển cảnh mượt.
   - Hỗ trợ cỡ chữ hệ thống lớn, nhãn trợ năng cho nút chỉ có icon.
   - Kiểm tra trên màn hình nhỏ và trên cả iOS lẫn Android.

6. **Chuẩn bị phát hành thử**
   - Icon, splash, tên app, mô tả quyền truy cập ảnh và camera.
   - Cấu hình EAS cho bản development và preview.
   - Ghi hướng dẫn build vào `apps/mobile/README.md`.

## Ràng buộc

- Không mở khóa tính năng chỉ dựa vào trạng thái phía app.
- Việc mua gói ngay trong app (RevenueCat) nằm ngoài phạm vi giai đoạn này.

## Hoàn thành khi

- Tài khoản Free hết lượt thấy đúng màn hết lượt, sang tháng mới dùng lại được.
- Xóa tài khoản hoạt động trọn vẹn.
- Bản preview cài được lên máy thật qua EAS.
- `turbo build test lint` xanh.
- Đã cập nhật `progress/frontend.md` và `CONTRACT_CHANGES.md`.
