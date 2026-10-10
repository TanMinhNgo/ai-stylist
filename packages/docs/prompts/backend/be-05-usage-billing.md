# Prompt BE-05 — Hạn mức, gói đăng ký, hoàn thiện

**Giao cho:** Codex. **Giai đoạn:** 5. **Cần xong trước:** BE-04.

---

Kiểm soát chi phí AI theo gói và chuẩn bị backend cho người dùng thật.

## Việc cần làm

1. **Gói**
   - `PlanService.getUserPlan(userId)` là nơi duy nhất trả về gói của user: `free`, `plus`, `pro`.
   - Bản cài đặt hiện tại đọc gói từ Clerk. Trước khi viết, đọc tài liệu Clerk Billing để xác nhận cách kiểm tra plan ở backend.
   - Thiết kế dạng interface `PlanSource` để sau này thêm nguồn RevenueCat mà không sửa nơi gọi.
   - Cache kết quả trong Redis thời gian ngắn, xóa cache khi nhận webhook thay đổi gói.

2. **Hạn mức**
   - Bảng `usage_ledger`.
   - Cấu hình hạn mức theo gói đặt ở một nơi, đọc từ biến môi trường với giá trị mặc định theo `architecture.md`.
   - `UsageService.reserve(userId, jobId)`: kiểm tra và ghi `-1` trong cùng một transaction, tránh hai request đồng thời vượt hạn mức.
   - `UsageService.refund(jobId)`: ghi `+1`, chỉ một lần cho mỗi job.
   - Chu kỳ tính theo tháng dương lịch, múi giờ UTC.
   - Hết lượt trả lỗi `QUOTA_EXCEEDED` kèm thời điểm được làm mới.

3. **Endpoint**
   - `GET /usage`: gói hiện tại, hạn mức, đã dùng, còn lại, thời điểm làm mới.

4. **Ưu tiên hàng chờ**
   - Job của gói `pro` có độ ưu tiên cao hơn trong BullMQ.

5. **Bảo vệ**
   - Rate limit theo user cho các endpoint tốn kém (`/try-on`, `/garments`, `/model-photos`, `/stylist/suggest`).
   - Giới hạn số job đang chạy đồng thời của một user.

6. **Quyền riêng tư**
   - `DELETE /me`: xóa toàn bộ dữ liệu và ảnh trên ImageKit của user, chạy qua queue, an toàn khi chạy lại.
   - Rà soát log: không còn URL ảnh, email hay token.

7. **Vận hành**
   - Log chi phí ước tính cho mỗi lời gọi AI, gắn `userId` và `jobId`.
   - Endpoint nội bộ hoặc script thống kê chi phí theo ngày và theo user.

8. **Contract**
   - `UsageResponse`, enum `Plan`, mã lỗi `QUOTA_EXCEEDED`, `RATE_LIMITED`.

## Ràng buộc

- Quyết định về gói và hạn mức chỉ nằm ở backend. Không tin giá trị gói gửi từ client.
- Trừ và hoàn lượt phải đúng kể cả khi job retry hoặc worker khởi động lại giữa chừng.

## Kiểm thử

- Hai request đồng thời khi còn đúng 1 lượt: chỉ một request thành công.
- Job thất bại hoàn đúng một lượt, kể cả khi hàm hoàn bị gọi hai lần.
- Chuyển tháng làm mới hạn mức.

## Hoàn thành khi

- User gói Free bị chặn ở lượt vượt hạn mức với đúng mã lỗi.
- `DELETE /me` xóa sạch dữ liệu và ảnh.
- `turbo build test lint` xanh.
- Đã ghi `CONTRACT_CHANGES.md` và `progress/backend.md`.
