# AI Stylist mobile · Expo SDK57

Chạy từ repo root: `npm install`, rồi `npm run dev`. Launcher chờ API healthy và tự lấy IP LAN Wi-Fi hiện tại cho Expo; điện thoại và máy chạy API phải cùng mạng. Không hard-code IP hoặc dùng localhost trên điện thoại. Mobile chỉ chứa public Clerk/ImageKit config, không chứa backend secrets.

## Kiểm tra local

`npm run test --workspace mobile`, `npm run lint --workspace mobile`; trong apps/mobile chạy `npx expo export --platform ios --platform android --output-dir dist/phase05`. Export tạo bundle để kiểm tra, không phải file cài đặt.

## Hạn mức và xóa tài khoản

Studio/Hồ sơ đọc GET /usage. Chỉ thử đồ trừ lượt tháng UTC; PNG quota ngày riêng. Sau tạo/fail và khi app foreground, mobile làm mới usage. 429 không tự gửi lại liên tục. Không có giá, checkout hoặc mua gói trong app.

Xóa tài khoản cần hai xác nhận, lần hai nhập XÓA. Chỉ đăng xuất khi nhận receipt từ DELETE /me; lỗi mạng có thể thử lại DELETE (server trả cùng deletionId) hoặc kiểm tra GET /me/deletion. Receipt là yêu cầu đã nhận, purge nền có thể mất12–20phút hoặc lâu hơn. Sau Clerk revoke, trạng thái có thể401; worker vẫn tiếp tục. Trang legal là bản dự thảo, chưa phê duyệt.

## EAS development và preview

Đã có eas.json và expo-dev-client. `npm run dev` / `npm start` vẫn mở bằng Expo Go (`expo start --go`); khi đã cài development build thì chạy `npm run start:dev-client`. Chưa tạo/ghép Expo cloud project, chưa build hoặc publish. Người sở hữu cần tài khoản Expo và quyền dự án; iOS physical-device internal build cần Apple Developer và đăng ký thiết bị.

1. Trong apps/mobile, người sở hữu chạy `npx eas-cli@latest login`, rồi `npx eas-cli@latest init` để ghép đúng dự án. Lệnh này thêm projectId thật; không dùng UUID giả.
2. Chốt `ios.bundleIdentifier`, `android.package` và owner theo tài khoản thực tế. Hiện identifier còn thiếu để tránh mạo danh namespace.
3. Cấu hình EAS environment development/preview với EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY, EXPO_PUBLIC_API_URL (HTTPS API thật điện thoại truy cập được), EXPO_PUBLIC_IMAGEKIT_PUBLIC_KEY, EXPO_PUBLIC_IMAGEKIT_URL_ENDPOINT. Không dùng localhost/IP LAN cố định cho preview phát cho người khác.
4. Khi đã chuẩn bị xong: `npx eas-cli@latest build --profile development --platform android` hoặc `npx eas-cli@latest build --profile preview --platform android`; preview tạo APK internal. iOS thay `--platform ios` và cấp provisioning đúng thiết bị.
5. Cài artifact từ EAS lên điện thoại, nghiệm thu đăng nhập, quota0/tháng mới, mất mạng/kết nối lại, chữ lớn, màn hình nhỏ, xóa tài khoản, share chooser. Chỉ lúc đó mới coi preview cài được.

Icon/splash/tên app và mô tả quyền camera/ảnh tiếng Việt hiện có trong app.json. Chưa có URL điều khoản/contact pháp lý thật hoặc Store approval. Không chạy EAS build/update/submit tự động.
