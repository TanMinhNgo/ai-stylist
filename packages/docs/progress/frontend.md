# Tiến độ frontend

Agent frontend cập nhật file này cuối mỗi phiên. Giữ ngắn gọn, mục mới nhất ở trên.

## Trạng thái hiện tại

- Giai đoạn: 0 xong phía mobile; 1 đang làm (khung app xong, chờ Clerk key và `GET /me`)
- Màn hình đã xong: 4 tab Studio, Tủ đồ, Lookbook (giữ chỗ), Hồ sơ (kiểm tra `/health`)
- Đang dùng dữ liệu giả ở: (không)
- Đang chờ backend: phân loại món đồ 2 cấp (yêu cầu 2026-10-10 trong CONTRACT_CHANGES.md)

## Mẫu ghi mỗi phiên

```md
## YYYY-MM-DD · Giai đoạn N
- Đã xong:
- Đang dở:
- Đang dùng dữ liệu giả ở:
- Đã xử lý thay đổi contract: (dẫn tới mục trong CONTRACT_CHANGES.md)
- Yêu cầu mới gửi backend:
- Việc tiếp theo:
```

## Nhật ký

## 2026-10-10 · Giai đoạn 0 (mobile) và khung giai đoạn 1
- Đã xong: thêm `apps/mobile` vào npm workspaces ở `package.json` gốc (lockfile riêng của mobile đã bỏ, cài lại từ gốc); `npm ls react` chỉ còn 19.2.3, `expo-doctor` 21/21. Mobile dùng `@stylist/shared` (`"*"`), Metro tự cấu hình monorepo (SDK 57, không cần `metro.config.js`). Dọn template Expo. Thêm theme theo bản thiết kế (`src/theme`), component chung có Liquid Glass/fallback và ba trạng thái tải/rỗng/lỗi (`src/components/ui.tsx`), Axios + `request(schema, config)` parse bằng schema chung, `RequestError` với mã từ `@stylist/shared` cộng `NETWORK_ERROR`/`BAD_RESPONSE`, thông báo tiếng Việt, TanStack Query không retry 4xx. 4 tab bằng `NativeTabs`; Hồ sơ gọi và parse `GET /health`.
- Kiểm chứng: `npx turbo build test lint` xanh (8 task, gồm 4 test mobile cho map lỗi và `tsc --noEmit`); `expo export` bundle được iOS và Android. Chưa chạy trên thiết bị hoặc giả lập.
- Đang dở: đăng nhập Clerk (FE-01 mục 2) chưa làm vì chưa có `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`; Hồ sơ chưa gọi `/me` vì BE-01 chưa có.
- Đang dùng dữ liệu giả ở: không.
- Đã xử lý thay đổi contract: `foundation · ADDED`, `local-dev · CHANGED` (đã tick).
- Yêu cầu mới gửi backend: không. Lưu ý cho backend: `lint` của mobile là `tsc --noEmit`, `test` là `node --test test/*.test.mjs` nên turbo gốc chạy cả mobile.
- Sửa sau phản hồi: iOS bị cộng vùng an toàn hai lần (NativeTabs đã tự inset ScrollView đầu tiên) nên bỏ inset tay trên iOS; Android tự xử lý phần trên. Android dùng thanh tab viên thuốc nổi theo thiết kế (`(tabs)/_layout.android.tsx`, JS Tabs), iOS giữ NativeTabs Liquid Glass; danh sách tab chung ở `src/components/tabs.ts`. iOS sau đó vẫn lệch xuống vì content inset tự động cộng thêm vào nội dung `flexGrow`; đã chuyển sang `disableAutomaticContentInsets` + `SafeAreaView` của `react-native-screens/experimental` (đo đúng thanh tab), đánh đổi: nội dung không cuộn xuyên dưới thanh tab kính nữa.
- Việc tiếp theo: Clerk (`@clerk/expo` + `expo-secure-store`), nhóm `(auth)`, interceptor gắn token, xử lý `UNAUTHORIZED`; Hồ sơ hiển thị email từ `/me` khi BE-01 xong.

## 2026-10-10 · Thiết kế UI (trước giai đoạn 1)
- Đã xong: bản thiết kế UI iOS Liquid Glass gồm 12 màn và bảng "Phân loại trang phục" (https://claude.ai/artifact/UENb5WHss3aZa6GMqaYYbu). Studio có người mẫu 3D nam/nữ tự sinh bằng code (không dùng model bên ngoài) và 49 món đồ, phụ kiện dựng theo vùng cơ thể.
- Đang dở: chưa viết code trong `apps/mobile`.
- Đang dùng dữ liệu giả ở: toàn bộ bản thiết kế (tủ đồ, lookbook, tư vấn đều là dữ liệu mẫu).
- Đã xử lý thay đổi contract: chưa (2 mục `foundation` và `local-dev` còn chờ FE).
- Yêu cầu mới gửi backend: phân loại 2 cấp `GarmentCategory`/`GarmentType`/`GarmentSlot` và các thuộc tính tag.
- Việc tiếp theo: FE-01. Nếu giữ người mẫu 3D trong app: chuyển script sinh model vào `scripts/`, xuất GLB, dùng `expo-gl` + `@react-three/fiber/native`.
