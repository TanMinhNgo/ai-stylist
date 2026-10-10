# Prompt 00 — Dựng monorepo

**Giao cho:** một agent bất kỳ, chạy một lần. Sau bước này hai agent mới tách việc.

---

Dựng khung monorepo cho dự án AI Stylist theo `packages/docs/architecture.md`.

## Yêu cầu

1. **Workspace:** npm workspaces + Turborepo. File gốc: `package.json`, `turbo.json`, `tsconfig.base.json`, `.node-version`, `.npmrc`, `.prettierrc.json`, `.gitignore`, `.gitattributes`.

2. **`packages/shared`** (tên package `@stylist/shared`):
   - TypeScript, build ra `dist`, có `src/` và `test/`.
   - Phụ thuộc duy nhất là `zod`. Không phụ thuộc React hay Node API.
   - Tạo `src/errors.ts` với schema lỗi chung `{ code, message, details? }` và enum mã lỗi ban đầu: `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `VALIDATION_ERROR`, `INTERNAL_ERROR`.
   - Tạo `src/health.ts` với `HealthResponse`.
   - Script `dev` chạy `tsc --watch`.

3. **`apps/api`:** NestJS, có `GET /health` trả đúng `HealthResponse`. Pipe validate bằng Zod dùng chung. Filter chuyển mọi lỗi về định dạng lỗi chung. Có `.env.example`.

4. **`apps/mobile`:** Expo với Expo Router và TypeScript. Một màn hình gọi `GET /health`, parse bằng `HealthResponse` từ `@stylist/shared`, hiển thị kết quả. Có `.env.example`.

5. **`docker-compose.yml`:** chỉ có Redis.

6. **`scripts/wait-for-api.mjs`:** đợi `GET /health` trả 200 trước khi chạy bước tiếp theo.

7. **Turbo:** `build`, `dev`, `test`, `lint`. `dev` và `build` của hai app phụ thuộc `^build` để `shared` luôn được build trước.

8. **Kiểm tra contract:** script `scripts/check-contract-log.mjs` báo lỗi khi diff có thay đổi trong `packages/shared/src` mà không có thay đổi trong `packages/docs/CONTRACT_CHANGES.md`. Gắn vào task `lint` ở gốc.

## Ràng buộc

- Chỉ có một bản React trong toàn repo. Kiểm tra bằng `npm ls react`.
- Nếu Metro không tìm thấy `@stylist/shared`, cấu hình `watchFolders` trong `metro.config.js`.
- Không commit file `.env`.

## Hoàn thành khi

- `npm install` rồi `npx turbo build test lint` chạy xanh.
- `npm run dev` khởi động Redis, API và Expo; app hiển thị được kết quả `/health`.
- Thêm mục đầu tiên vào `CONTRACT_CHANGES.md` (ADDED: `HealthResponse`, schema lỗi chung).
- Cập nhật cả hai file trong `packages/docs/progress/`.
