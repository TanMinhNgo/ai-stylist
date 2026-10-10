# Prompt FE-02 — Upload, ảnh người mẫu, tủ đồ

**Giao cho:** Claude Code. **Giai đoạn:** 2. **Cần backend:** BE-02.

---

Đọc `CONTRACT_CHANGES.md` và `progress/backend.md` để biết endpoint nào đã sẵn sàng. Endpoint chưa có thì dùng dữ liệu giả đúng schema và ghi lại.

## Việc cần làm

1. **Upload ảnh**
   - `src/lib/upload.ts`: lấy chữ ký từ `GET /uploads/auth`, upload thẳng lên ImageKit, trả `fileId` và `url`.
   - Chọn từ thư viện hoặc chụp mới bằng `expo-image-picker`, xin quyền đúng lúc cần và giải thích lý do.
   - Nén và resize trên máy trước khi upload (cạnh dài khoảng 1600px).
   - Hiển thị tiến trình, cho phép hủy và thử lại.

2. **Ảnh người mẫu**
   - Màn hướng dẫn chụp: toàn thân, đứng thẳng, đủ sáng, nền gọn, một người. Có hình minh họa nên và không nên.
   - Sau khi upload gọi `POST /model-photos`, hiển thị trạng thái đang phân tích.
   - Lỗi `PHOTO_NOT_FULL_BODY`, `PHOTO_MULTIPLE_PEOPLE`, `PHOTO_NOT_ALLOWED` có thông báo riêng và gợi ý cách chụp lại.
   - Danh sách ảnh người mẫu, chọn ảnh mặc định, xóa ảnh.

3. **Tủ đồ**
   - Lưới ảnh 2 hoặc 3 cột, thumbnail qua URL ImageKit có tham số resize.
   - Bộ lọc theo `GarmentCategory`.
   - Cuộn vô hạn bằng `useInfiniteQuery` theo cursor.
   - Thêm món: chọn ảnh, upload, `POST /garments`. Thêm được nhiều ảnh một lần.
   - Món đang `pending` hiển thị trạng thái đang xử lý, tự cập nhật khi `ready`.
   - Màn chi tiết: ảnh lớn, tag AI gắn (loại, màu, chất liệu, độ trang trọng), nút xóa có xác nhận.

4. **Trạng thái rỗng**
   - Tủ đồ trống: hướng dẫn thêm món đầu tiên.
   - Chưa có ảnh người mẫu: dẫn tới màn hướng dẫn chụp.

## Ràng buộc

- Không tải ảnh gốc cho lưới.
- Xóa dùng cập nhật lạc quan, hoàn tác khi lỗi.

## Hoàn thành khi

- Thêm ảnh người mẫu và ít nhất 3 món đồ từ app, thấy tag hiển thị.
- Lọc và cuộn mượt với vài chục món.
- `turbo build test lint` xanh.
- Đã cập nhật `progress/frontend.md` và `CONTRACT_CHANGES.md`.
