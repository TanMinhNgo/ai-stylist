# Prompt BE-03 — Luồng thử đồ

**Giao cho:** Codex. **Giai đoạn:** 3. **Cần xong trước:** BE-02 và thử nghiệm AI (prompt 01).

---

Đọc `packages/docs/decisions/001-tryon-provider.md` để biết nhà cung cấp đã chốt và prompt nào cho kết quả tốt nhất. Xây luồng thử đồ theo mục 5 của `architecture.md`.

## Việc cần làm

1. **`TryOnProvider`**
   - Interface: nhận URL ảnh người mẫu, danh sách URL món đồ, ngữ cảnh (dịp), trả ảnh kết quả.
   - Bản cài đặt theo quyết định ở `001-tryon-provider.md`. Tên model đọc từ biến môi trường.
   - Bản giả lập (`FakeTryOnProvider`) cho test và dev, bật bằng biến môi trường.
   - Chuyển lỗi của nhà cung cấp thành mã lỗi nội bộ: `TRYON_CONTENT_REJECTED`, `TRYON_TIMEOUT`, `TRYON_PROVIDER_ERROR`.

2. **Job**
   - Bảng `tryon_jobs`.
   - `POST /try-on`: validate, kiểm tra quyền sở hữu ảnh và món đồ, kiểm tra món đồ đã `ready`, tạo job `queued`, đẩy vào queue `try-on`, trả `jobId`.
   - `GET /try-on/:id`: trả trạng thái, `resultUrl`, `errorCode`, và `outfitId` khi xong.

3. **Worker**
   - Chuyển trạng thái: `queued` → `processing` → `done` hoặc `failed`.
   - Resize ảnh đầu vào qua URL ImageKit trước khi gửi.
   - Lưu ảnh kết quả lên ImageKit, tạo bản ghi `outfits` (chưa có tư vấn, sẽ thêm ở BE-04).
   - Retry tối đa 2 lần với backoff cho lỗi tạm thời. Không retry khi `TRYON_CONTENT_REJECTED`.
   - Giới hạn số job chạy đồng thời.

4. **An toàn khi chạy lại**
   - Job chạy lại không tạo ảnh hay bản ghi `outfits` trùng.
   - `POST /try-on` nhận header `Idempotency-Key`, cùng key trả lại job cũ.

5. **Điểm móc cho hạn mức**
   - Gọi `UsageService.reserve()` trước khi tạo job và `UsageService.refund()` khi job thất bại. Hiện tại hai hàm chưa giới hạn gì, sẽ cài đặt ở BE-05.

6. **Contract**
   - `CreateTryOnRequest` (garmentIds từ 1 đến 4), `CreateTryOnResponse`, `TryOnJobResponse`, enum `TryOnStatus`, các mã lỗi mới.

## Ràng buộc

- Không gọi nhà cung cấp AI trong request, chỉ trong worker.
- Job treo ở `processing` quá thời gian quy định phải được chuyển sang `failed`.

## Kiểm thử

- Máy trạng thái của job, kể cả retry và thất bại.
- Idempotency: gửi hai lần cùng key chỉ tạo một job.
- Lỗi bị từ chối nội dung không retry.

## Hoàn thành khi

- Tạo job bằng API, worker xử lý xong, `GET /try-on/:id` trả ảnh kết quả.
- Chạy được toàn bộ luồng với `FakeTryOnProvider` mà không tốn tiền.
- `turbo build test lint` xanh.
- Đã ghi `CONTRACT_CHANGES.md` và `progress/backend.md`.
