# AGENTS.md — Hướng dẫn cho agent backend (Codex)

Bạn phụ trách `apps/api` và là bên sở hữu `packages/shared`. Frontend (`apps/mobile`) do một agent khác phụ trách, không sửa thư mục đó.

## Đọc trước khi làm

1. `packages/docs/CONTRACT_CHANGES.md`: xử lý mục "Yêu cầu đang chờ" trước.
2. `packages/docs/architecture.md`: schema, API, luồng.
3. `packages/docs/progress/backend.md`: việc đang dở.
4. Prompt của giai đoạn hiện tại trong `packages/docs/prompts/backend/`.

## Phạm vi

| Được sửa | Không được sửa |
|---|---|
| `apps/api/**` | `apps/mobile/**` |
| `packages/shared/**` | `CLAUDE.md` |
| `packages/docs/**` (trừ `progress/frontend.md`) | |

## Luật contract

1. Mọi request và response của API phải có Zod schema trong `packages/shared/src`, export qua `index.ts`.
2. Mỗi thay đổi trong `packages/shared` phải kèm một mục mới ở đầu `CONTRACT_CHANGES.md`, trong cùng commit.
3. Gắn nhãn đúng: `ADDED`, `CHANGED`, `BREAKING`. Với `BREAKING`, ghi rõ frontend cần sửa gì.
4. Không đổi tên hoặc xóa trường đang dùng nếu chưa ghi `BREAKING`.
5. Khi làm xong một mục trong "Yêu cầu đang chờ", chuyển nó thành một mục thay đổi.

## Quy ước code

- NestJS chia module theo tính năng: `auth`, `uploads`, `model-photos`, `garments`, `try-on`, `stylist`, `outfits`, `usage`.
- Controller chỉ nhận và trả dữ liệu. Logic nằm trong service. Truy cập DB qua repository.
- Validate đầu vào bằng schema từ `@stylist/shared`. Không viết DTO trùng lặp.
- Nhà cung cấp bên ngoài (OpenAI, ImageKit, Clerk) bọc sau interface để thay thế và mock được.
- Tác vụ AI chạy qua BullMQ, không gọi trực tiếp trong request.
- Lỗi trả về theo định dạng chung `{ code, message, details? }`, mã lỗi lấy từ `packages/shared/src/errors.ts`.
- Mọi truy vấn dữ liệu người dùng phải lọc theo `userId` lấy từ token, không nhận `userId` từ client.

## Bảo mật

- Khóa bí mật chỉ nằm trong `apps/api/.env`, không commit. Cập nhật `.env.example` khi thêm biến mới.
- Verify chữ ký mọi webhook.
- Ảnh người mẫu là dữ liệu nhạy cảm: không log URL đầy đủ, hỗ trợ xóa hẳn.

## Kiểm thử

- Viết test cho service có logic: hạn mức, trừ và hoàn lượt, chuyển trạng thái job.
- Mock nhà cung cấp bên ngoài, không gọi API thật trong test.
- Chạy `turbo build test lint` trước khi kết thúc phiên.

## Cuối mỗi phiên

Cập nhật `packages/docs/progress/backend.md`: đã xong, đang dở, bị chặn bởi gì, endpoint mới sẵn sàng cho frontend.
