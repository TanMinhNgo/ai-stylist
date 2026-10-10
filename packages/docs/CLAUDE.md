# CLAUDE.md — Hướng dẫn cho agent frontend (Claude Code)

Bạn phụ trách `apps/mobile`. Backend (`apps/api`) và `packages/shared` do một agent khác phụ trách, không sửa hai nơi đó.

## Đọc trước khi làm

1. `packages/docs/CONTRACT_CHANGES.md`: xử lý các mục có "Trạng thái FE: [ ]" trước.
2. `packages/docs/architecture.md`: API và luồng.
3. `packages/docs/progress/backend.md`: endpoint nào đã sẵn sàng.
4. `packages/docs/progress/frontend.md`: việc đang dở.
5. Prompt của giai đoạn hiện tại trong `packages/docs/prompts/frontend/`.

## Phạm vi

| Được sửa | Không được sửa |
|---|---|
| `apps/mobile/**` | `apps/api/**` |
| `packages/docs/progress/frontend.md` | `packages/shared/**` |
| Mục "Yêu cầu đang chờ" và ô tick "Trạng thái FE" trong `CONTRACT_CHANGES.md` | `AGENTS.md` |

## Luật contract

1. Mọi type và schema của API import từ `@stylist/shared`. Không khai báo lại trong `apps/mobile`.
2. Parse mọi response bằng schema tương ứng trước khi dùng.
3. Cần backend thêm hoặc đổi gì: ghi vào mục "Yêu cầu đang chờ" trong `CONTRACT_CHANGES.md`, nêu rõ endpoint, trường, lý do. Không tự sửa `packages/shared`.
4. Khi endpoint chưa sẵn sàng, dùng dữ liệu giả đúng theo schema và ghi lại trong `progress/frontend.md` để thay sau.
5. Xử lý xong một thay đổi contract thì tick "Trạng thái FE: [x]".

## Quy ước code

- Expo Router. Chia theo tính năng trong `src/features/<tên>/` gồm `api.ts`, `hooks.ts`, `components/`.
- TanStack Query cho dữ liệu server. Zustand chỉ cho state cục bộ (outfit đang chọn dở, bước onboarding).
- Một Axios instance duy nhất trong `src/lib/api.ts`, gắn token Clerk bằng interceptor.
- Lỗi API hiển thị theo `code` từ `@stylist/shared`, không hiển thị thông báo thô từ server.
- Mọi màn hình có đủ ba trạng thái: đang tải, rỗng, lỗi.
- Ảnh hiển thị qua URL ImageKit kèm tham số resize, không tải ảnh gốc cho thumbnail.

## Trải nghiệm

- Try-on mất hàng chục giây: luôn có màn chờ rõ ràng, cho phép rời đi và quay lại.
- Giọng tư vấn tích cực, nói về trang phục, không nhận xét tiêu cực về cơ thể.
- Không hiển thị giá hoặc nút mua gói trong app (gói mua trên web).

## Bảo mật

- Chỉ dùng khóa công khai với tiền tố `EXPO_PUBLIC_`. Không đưa khóa bí mật vào app.
- Token lưu bằng `expo-secure-store`.

## Kiểm thử

- Test cho hook có logic và các hàm tiện ích.
- Chạy `turbo build test lint` trước khi kết thúc phiên.
- IAP và một số module native không chạy trong Expo Go, dùng development build khi cần.

## Cuối mỗi phiên

Cập nhật `packages/docs/progress/frontend.md`: đã xong, đang dở, đang dùng dữ liệu giả ở đâu, đang chờ backend điều gì.
