# AI Stylist

App mobile đóng vai một nhà thiết kế thời trang cá nhân: người dùng gửi ảnh người mẫu, thử đồ lên ảnh đó, nhận tư vấn phối đồ và phụ kiện, lưu lại gu riêng.

## Stack

| Phần | Lựa chọn |
|---|---|
| Monorepo | npm workspaces + Turborepo |
| Mobile | React Native (Expo, Expo Router), TanStack Query, Zustand, Axios |
| Backend | NestJS, BullMQ, Redis |
| Database | Neon (PostgreSQL + pgvector), Prisma |
| Auth | Clerk |
| Ảnh | ImageKit |
| AI | OpenAI (image edit cho try-on, vision cho tư vấn, embeddings cho cá nhân hóa) |
| Gói đăng ký | Clerk Billing (mua trên web), bọc sau `getUserPlan()` để đổi được sang RevenueCat |

## Phân công

| Phần | Agent | File hướng dẫn |
|---|---|---|
| `apps/api`, `packages/shared` | Codex | `AGENTS.md` |
| `apps/mobile` | Claude Code | `CLAUDE.md` |

## Cách dùng bộ tài liệu này

1. Chép toàn bộ vào gốc repo mới (giữ nguyên cấu trúc thư mục).
2. Chạy `packages/docs/prompts/00-setup-monorepo.md` một lần để dựng khung.
3. Chạy `packages/docs/prompts/01-ai-spike.md` để chốt chất lượng và chi phí try-on trước khi viết app.
4. Mở [ROADMAP.md](ROADMAP.md), chọn file giai đoạn trong `roadmap/` để biết kết quả cần đạt và checklist. Với giai đoạn 1–5, giao prompt backend cho Codex trước để có contract, sau đó giao prompt frontend cho Claude Code.
5. Sau mỗi phiên, kiểm tra `packages/docs/CONTRACT_CHANGES.md` và `packages/docs/progress/`.

## Tài liệu

- [ROADMAP.md](ROADMAP.md): tổng quan và thứ tự phát triển
- `packages/docs/roadmap/`: một file cho mỗi giai đoạn, gồm chức năng, phân công, demo và điều kiện hoàn thành
- `packages/docs/architecture.md`: kiến trúc, schema, API, luồng chính
- `packages/docs/CONTRACT_CHANGES.md`: nhật ký thay đổi contract giữa backend và frontend
- `packages/docs/progress/`: tiến độ của từng bên
- `packages/docs/prompts/`: prompt giao việc cho từng giai đoạn

## Giả định cần xác nhận

- Tên dự án `ai-stylist`, scope package `@stylist/shared`. Đổi bằng tìm và thay thế toàn bộ.
- ORM là Prisma. Nếu dùng Drizzle, sửa phần liên quan trong `architecture.md` và prompt `be-01`.
- Tên model OpenAI đặt trong biến môi trường, không ghi cứng trong code.
