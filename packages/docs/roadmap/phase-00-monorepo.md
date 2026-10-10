# Giai đoạn 0 — Dựng monorepo

[← Roadmap](../ROADMAP.md) · [Tiếp: Thử nghiệm AI →](phase-00a-ai-spike.md)

## Kết quả sản phẩm

Có khung Expo và NestJS chạy được cùng workspace. App gọi API và hiểu response bằng schema chung. Đây là nền tảng phát triển, chưa có tính năng stylist cho người dùng.

**Điều kiện bắt đầu:** kiểm tra khung repo hiện có, giữ phần đã phù hợp thay vì tạo lại toàn bộ.

**Prompt:** [00 — Setup monorepo](../prompts/00-setup-monorepo.md). Đây là bước setup dùng chung trước khi hai bên tách việc; việc sửa mobile cần giao đúng bên phụ trách.

## Chức năng và thành phần bổ sung

- npm workspaces, Turborepo, TypeScript và lệnh dev/build/test/lint.
- `@stylist/shared` chứa `HealthResponse`, schema lỗi và mã lỗi nền tảng.
- `GET /health`, validation pipe và error filter ở API.
- Màn kiểm tra kết nối API trên mobile.
- Redis local, script đợi API và kiểm tra thay đổi contract có nhật ký.

## Các bước triển khai

| Bước | Backend / shared | Mobile / phối hợp | Điểm kiểm chứng |
|---|---|---|---|
| 0.1 | Chuẩn hóa workspace và shared package | Kiểm tra Expo và một bản React dùng chung | Hai app resolve được shared |
| 0.2 | Health contract, endpoint và lỗi chung | Gọi health, parse schema, hiển thị kết quả | App hiển thị response từ API thật |
| 0.3 | Redis, lệnh dev, script chờ API, contract check | API URL theo thiết bị | Khởi động môi trường theo quy trình đã ghi |

## Điều kiện hoàn thành

- [ ] `npm install` và `npx turbo build test lint` thành công.
- [ ] `npm ls react` không có các bản React xung đột.
- [ ] `npm run dev` khởi động được Redis, API và Expo.
- [ ] App nhận và parse đúng health; lỗi kết nối hiển thị rõ.
- [ ] `.env.example` đủ biến; secret không nằm trong source.
- [ ] Có mục contract ban đầu và cập nhật tiến độ hai bên theo quyền sở hữu.

**Demo cuối giai đoạn:** khởi động môi trường → mở app → thấy API đang hoạt động.

## Giới hạn giai đoạn

Chưa làm auth, database nghiệp vụ, upload hay AI. Chạy trên máy phát triển chưa chứng minh kết nối được từ điện thoại; cần kiểm tra API URL và mạng khi dùng thiết bị thật.
