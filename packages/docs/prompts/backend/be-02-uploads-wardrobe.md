# Prompt BE-02 — Upload, ảnh người mẫu, tủ đồ

**Giao cho:** Codex. **Giai đoạn:** 2. **Cần xong trước:** BE-01.

---

Đọc `CONTRACT_CHANGES.md` và xử lý yêu cầu đang chờ trước. Sau đó xây phần upload, ảnh người mẫu và tủ đồ.

## Việc cần làm

1. **Upload**
   - `ImageStorageProvider` (interface) và bản cài đặt ImageKit.
   - `GET /uploads/auth` trả `token`, `expire`, `signature`, `publicKey`, `urlEndpoint`.
   - Hàm tạo URL đã resize và signed URL có hạn cho ảnh private.

2. **Tầng vision**
   - `VisionProvider` (interface) và bản cài đặt OpenAI, dùng structured output.
   - Tên model đọc từ `OPENAI_VISION_MODEL`.
   - Prompt đặt trong file riêng có phiên bản. Validate đầu ra bằng Zod.

3. **Ảnh người mẫu**
   - Bảng `model_photos`.
   - `POST /model-photos` nhận `imagekitFileId` và `url`. Xác minh file tồn tại trên ImageKit trước khi lưu.
   - Phân tích qua queue `analysis`: dáng người, tông da, ghi chú tỉ lệ, và kiểm tra ảnh có dùng được không (toàn thân, đủ sáng, một người).
   - Từ chối ảnh không phù hợp với mã lỗi riêng: `PHOTO_NOT_FULL_BODY`, `PHOTO_MULTIPLE_PEOPLE`, `PHOTO_NOT_ALLOWED`.
   - `GET /model-photos`, `DELETE /model-photos/:id` (xóa cả trên ImageKit).

4. **Tủ đồ**
   - Bảng `garments` có cột `embedding`.
   - `POST /garments`: lưu, rồi qua queue gắn tag (category, colors, material, formality) và tạo embedding từ mô tả.
   - `GET /garments`: lọc theo `category`, phân trang bằng cursor.
   - `DELETE /garments/:id`.
   - Trạng thái xử lý của mỗi món: `pending`, `ready`, `failed`.

5. **Contract**
   - Schema cho mọi request và response ở trên, cùng enum `GarmentCategory`, `Formality`, `ProcessingStatus`.

## Ràng buộc

- Mọi truy vấn lọc theo user hiện tại. Truy cập tài nguyên của người khác trả `NOT_FOUND`.
- Không log URL ảnh người mẫu.
- Danh sách luôn có giới hạn kích thước trang.

## Kiểm thử

- Quyền sở hữu: user A không đọc hay xóa được dữ liệu của user B.
- Đầu ra vision sai định dạng được xử lý thành `failed`, không làm sập worker.

## Hoàn thành khi

- Thêm một món đồ rồi `GET /garments` thấy tag tự sinh.
- `turbo build test lint` xanh.
- Đã ghi `CONTRACT_CHANGES.md` và `progress/backend.md`.
