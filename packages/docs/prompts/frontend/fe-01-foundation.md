# Prompt FE-01 — Nền tảng mobile

**Giao cho:** Claude Code. **Giai đoạn:** 1. **Cần backend:** `GET /me` (BE-01).

---

Đọc `CLAUDE.md` và `packages/docs/architecture.md` trước. Xây nền tảng cho `apps/mobile`: điều hướng, đăng nhập, tầng gọi API.

## Việc cần làm

1. **Điều hướng (Expo Router)**
   - Nhóm `(auth)`: đăng nhập, đăng ký.
   - Nhóm `(tabs)`: Studio, Tủ đồ, Lookbook, Hồ sơ. Mỗi tab tạm là màn hình giữ chỗ.
   - Chưa đăng nhập thì chuyển về `(auth)`, đã đăng nhập thì vào `(tabs)`.

2. **Đăng nhập với Clerk**
   - `ClerkProvider` với token lưu bằng `expo-secure-store`.
   - Đăng nhập và đăng ký bằng email, có bước nhập mã xác minh.
   - Đăng nhập bằng Google. Nếu bật trên iOS thì thêm cả Sign in with Apple.
   - Đăng xuất ở tab Hồ sơ.

3. **Tầng API**
   - `src/lib/api.ts`: một Axios instance, interceptor gắn token từ `getToken()`.
   - Hàm bọc `request(schema, config)` parse response bằng Zod schema từ `@stylist/shared`.
   - Chuyển lỗi về kiểu `ApiError` có `code` theo `@stylist/shared`.
   - `QueryClientProvider` với cấu hình retry hợp lý (không retry lỗi 4xx).

4. **Xử lý lỗi chung**
   - Bảng ánh xạ `code` sang thông báo tiếng Việt.
   - Lỗi `UNAUTHORIZED` thì đăng xuất và về màn đăng nhập.
   - Component chung: `LoadingState`, `EmptyState`, `ErrorState` có nút thử lại.

5. **Giao diện nền**
   - Bảng màu, cỡ chữ, khoảng cách đặt trong `src/theme/`. Phong cách tối giản, sang, để ảnh thời trang là trung tâm.
   - Component cơ bản: `Button`, `Text`, `Screen`, `Card`.

6. **Kiểm chứng**
   - Tab Hồ sơ gọi `GET /me` và hiển thị email.

## Ràng buộc

- Không khai báo type API trong `apps/mobile`.
- Chỉ dùng biến môi trường có tiền tố `EXPO_PUBLIC_`.

## Hoàn thành khi

- Đăng ký, đăng nhập, đăng xuất chạy trên thiết bị hoặc trình giả lập.
- Tab Hồ sơ hiển thị đúng user từ `GET /me`.
- `turbo build test lint` xanh.
- Đã cập nhật `progress/frontend.md` và tick các mục liên quan trong `CONTRACT_CHANGES.md`.
