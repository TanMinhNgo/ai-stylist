# Prompt BE-01 — Nền tảng backend

**Giao cho:** Codex. **Giai đoạn:** 1.

---

Đọc `AGENTS.md` và `packages/docs/architecture.md` trước. Xây nền tảng cho `apps/api`: database, xác thực, đồng bộ user.

## Việc cần làm

1. **Database**
   - Cài Prisma, cấu hình `DATABASE_URL` (pooled) và `DIRECT_URL` (direct).
   - Migration đầu tiên: bật extension `vector`, tạo bảng `users` theo `architecture.md`.
   - `PrismaModule` dùng chung, đóng kết nối đúng cách khi tắt app.

2. **Xác thực**
   - `ClerkAuthGuard` verify token bằng `@clerk/backend`, áp dụng mặc định cho mọi route.
   - Decorator `@Public()` cho `/health` và `/webhooks/*`.
   - Decorator `@CurrentUser()` trả về user nội bộ. Nếu token hợp lệ nhưng chưa có bản ghi `users` thì tạo mới (phòng khi webhook đến chậm).

3. **Webhook Clerk**
   - `POST /webhooks/clerk`: verify chữ ký, xử lý `user.created`, `user.updated`, `user.deleted`.
   - Xử lý lặp lại an toàn: cùng một sự kiện đến hai lần không gây lỗi hay trùng dữ liệu.

4. **Endpoint**
   - `GET /me` trả `MeResponse` (id, email, createdAt).

5. **Contract**
   - Thêm `MeResponse` vào `packages/shared`.
   - Bổ sung mã lỗi còn thiếu vào `errors.ts`.

6. **Hạ tầng chung**
   - Log có cấu trúc, mỗi request có request id.
   - Kết nối Redis và cấu hình BullMQ (chưa cần queue cụ thể).
   - Cập nhật `.env.example`.

## Ràng buộc

- Không nhận `userId` từ client ở bất kỳ đâu.
- Không log token hay header `Authorization`.

## Kiểm thử

- Guard: token thiếu, token sai, token hợp lệ.
- Webhook: chữ ký sai bị từ chối, sự kiện lặp lại không tạo trùng.

## Hoàn thành khi

- `GET /me` với token Clerk thật trả đúng user.
- `turbo build test lint` xanh.
- Đã ghi `CONTRACT_CHANGES.md` và `progress/backend.md`.
