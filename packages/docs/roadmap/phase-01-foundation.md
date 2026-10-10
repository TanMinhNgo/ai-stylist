# Giai đoạn 1 — Nền tảng và tài khoản

[← Thử nghiệm AI](phase-00a-ai-spike.md) · [Roadmap](../ROADMAP.md) · [Tiếp: Tủ đồ →](phase-02-wardrobe.md)

## Kết quả sản phẩm

Người dùng đăng ký, đăng nhập và vào app bằng tài khoản riêng. Backend nhận diện đúng user và có nền tảng lưu dữ liệu an toàn.

**Điều kiện bắt đầu:** giai đoạn 0 hoàn thành; Neon, Clerk và Redis sẵn sàng.

**Prompt:** [BE-01](../prompts/backend/be-01-foundation.md) · [FE-01](../prompts/frontend/fe-01-foundation.md).

## Chức năng bổ sung

- Đăng ký/đăng nhập email, xác minh, Google và Apple theo nền tảng; đăng xuất.
- Đồng bộ Clerk với user nội bộ qua webhook.
- Bốn tab Studio, Tủ đồ, Lookbook, Hồ sơ; tính năng chưa làm là màn giữ chỗ.
- Hồ sơ hiển thị thông tin API; xử lý loading/rỗng/lỗi chung.

## Các bước triển khai

| Bước | Backend / shared | Mobile | Điểm kiểm chứng |
|---|---|---|---|
| 1.1 | Prisma, users, pgvector, pooled/direct connection | Navigation và theme/component chung | Migration chạy được, đóng kết nối đúng |
| 1.2 | Clerk guard, current user, MeResponse, GET /me | ClerkProvider, secure token, đăng nhập/đăng xuất | Token thật trả đúng user |
| 1.3 | Verify webhook, created/updated/deleted lặp an toàn | Axios gắn token, parse response, TanStack Query | App hiển thị email từ /me |
| 1.4 | Request ID, log an toàn, Redis/BullMQ nền tảng | Lỗi tiếng Việt, loading/rỗng/lỗi, bốn tab | Token thiếu/sai và mất mạng được xử lý |

## Điều kiện hoàn thành

- [ ] Đăng ký, xác minh, đăng nhập/đăng xuất hoạt động trên thiết bị hoặc giả lập.
- [ ] `/me` đúng user với token thật; token thiếu/sai bị từ chối.
- [ ] Webhook sai chữ ký bị từ chối; sự kiện lặp không tạo user trùng.
- [ ] Token hợp lệ nhưng webhook chậm vẫn tạo/map user an toàn.
- [ ] Token trong secure storage; log không chứa token/Authorization.
- [ ] `npx turbo build test lint` xanh; contract và tiến độ được cập nhật.

**Demo cuối giai đoạn:** đăng ký → đăng nhập → Hồ sơ thấy email → đăng xuất về màn auth.

## Giới hạn giai đoạn

Chưa có tủ đồ/try-on. `user.deleted` ở đây là đồng bộ user; xóa toàn bộ ảnh và dữ liệu nghiệp vụ hoàn thiện ở 5. Kiểm chứng tài khoản thật không được thay bằng mock guard.
