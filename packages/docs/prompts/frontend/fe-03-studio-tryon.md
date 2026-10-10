# Prompt FE-03 — Studio và thử đồ

**Giao cho:** Claude Code. **Giai đoạn:** 3. **Cần backend:** BE-03.

---

Đây là màn hình quan trọng nhất của app. Ưu tiên cảm giác mượt và rõ ràng trong lúc chờ.

## Việc cần làm

1. **Màn Studio**
   - Bước 1: chọn ảnh người mẫu (mặc định là ảnh đã đặt làm chính).
   - Bước 2: chọn 1 đến 4 món từ tủ đồ. Hiển thị số món đã chọn, chặn khi quá 4 kèm giải thích.
   - Bước 3: chọn dịp (đi làm, đi chơi, tiệc, hẹn hò, khác có ô nhập).
   - Thanh xem trước các món đã chọn, bỏ chọn nhanh.
   - Lưu lựa chọn dở trong Zustand để không mất khi chuyển tab.
   - Chỉ cho chọn món đã `ready`.

2. **Tạo job**
   - Gọi `POST /try-on` kèm `Idempotency-Key` sinh mới cho mỗi lần bấm, chống bấm đúp.
   - Chuyển sang màn chờ với `jobId`.

3. **Màn chờ `try-on/[jobId]`**
   - Polling `GET /try-on/:id` bằng `refetchInterval`, dừng khi `done` hoặc `failed`.
   - Giãn dần khoảng cách polling, dừng khi app vào nền và tiếp tục khi quay lại.
   - Hiển thị tiến trình theo trạng thái (`queued`, `processing`) với nội dung thay đổi để người dùng biết app vẫn chạy.
   - Cho phép rời màn hình. Job đang chạy hiển thị ở Studio để quay lại.

4. **Màn kết quả**
   - Ảnh kết quả toàn màn hình, phóng to được.
   - So sánh trước và sau bằng thanh trượt hoặc nhấn giữ.
   - Nút: Lưu vào lookbook, Tạo lại, Thử đồ khác.
   - Chừa chỗ cho thẻ tư vấn (làm ở FE-04).

5. **Xử lý lỗi**
   - `TRYON_CONTENT_REJECTED`: giải thích ảnh không xử lý được, gợi ý đổi ảnh hoặc món đồ.
   - `TRYON_TIMEOUT`, `TRYON_PROVIDER_ERROR`: xin lỗi, nút thử lại.
   - `QUOTA_EXCEEDED`: thông báo hết lượt (màn chi tiết làm ở FE-05).
   - Mất mạng khi đang chờ: giữ `jobId`, tự tiếp tục khi có mạng.

6. **Thông báo**
   - Thông báo cục bộ khi job xong trong lúc app ở nền, nếu người dùng đã cho phép.

## Ràng buộc

- Không gọi `POST /try-on` lặp lại khi polling lỗi.
- Ảnh kết quả tải qua URL có resize phù hợp màn hình, ảnh gốc chỉ tải khi phóng to hoặc lưu.

## Hoàn thành khi

- Thử đồ trọn luồng trên thiết bị thật, kể cả rời app giữa chừng rồi quay lại.
- Mỗi loại lỗi hiển thị đúng thông báo.
- `turbo build test lint` xanh.
- Đã cập nhật `progress/frontend.md` và `CONTRACT_CHANGES.md`.
