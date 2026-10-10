# Tiến độ backend

Agent backend cập nhật file này cuối mỗi phiên. Giữ ngắn gọn, mục mới nhất ở trên.

## Trạng thái hiện tại

- Giai đoạn: 0 (API/shared hoàn thành phần nền; setup toàn dự án còn các mục bên dưới)
- Endpoint sẵn sàng cho frontend: GET /health
- Đang bị chặn bởi: (không)

## Mẫu ghi mỗi phiên

```md
## YYYY-MM-DD · Giai đoạn N
- Đã xong:
- Đang dở:
- Endpoint mới sẵn sàng:
- Thay đổi contract: (dẫn tới mục trong CONTRACT_CHANGES.md)
- Bị chặn bởi:
- Việc tiếp theo:
```

## Nhật ký

## 2026-10-10 · Giai đoạn 0 — LAN và khởi động tuần tự
- Đã xong: API bind 0.0.0.0; `npm run dev` chọn IPv4 LAN theo mỗi lần khởi động, bỏ adapter ảo, không ghi cứng IP. Nhiều kết nối thì dùng LAN_HOST cho lần chạy. Launcher chờ health trước Expo, truyền EXPO_PUBLIC_API_URL/host Metro động; `dev:api` chạy riêng backend.
- Kiểm chứng: 5 test launcher/health gate pass (đổi IP, adapter ảo, nhiều interface, timeout, hủy); `npx turbo build test lint` xanh với 14 test backend/shared. Chạy thật thấy health LAN thành công trước khi Expo bắt đầu; Metro /status hoạt động và API vẫn trả `{ status: "ok" }` sau Metro khởi động.
- Đang dở: chưa kiểm chứng trên điện thoại; chưa có caller fetch API trong mobile. Còn tích hợp shared/fetch trên mobile, Redis Compose và check-contract-log của phase 0.
- Endpoint mới sẵn sàng: GET /health qua địa chỉ LAN được in bởi launcher; không dùng 0.0.0.0 làm URL client.
- Thay đổi contract: mục `2026-10-10 · local-dev · CHANGED`; schema giữ nguyên.
- Bị chặn bởi: không cho launcher; điện thoại cần cùng mạng và kết nối không bị firewall/router chặn. Không thay cấu hình firewall.
- Việc tiếp theo: frontend đọc process.env.EXPO_PUBLIC_API_URL; kiểm tra /health bằng trình duyệt điện thoại. Đổi Wi-Fi thì dừng và chạy lại npm run dev.

## 2026-10-10 · Giai đoạn 0 — API và shared
- Đã xong: workspace npm/Turbo cho API/shared; HealthResponse, ApiError, ErrorCode; GET /health thay route Hello World; ZodValidationPipe; APP_FILTER chuẩn hóa lỗi và ẩn thông tin nội bộ 5xx; .env.example, PORT/CORS và hướng dẫn chạy API. Lockfile chuyển về gốc repo.
- Kiểm chứng: `npx turbo build test lint` qua 6 task; 2 test shared, 5 unit và 7 HTTP integration đều pass. Bản build chạy thật tại localhost:3000 trả `{ status: "ok" }`; route probe chỉ dùng trong test không xuất hiện trong bản production.
- Đang dở: giai đoạn 0 toàn dự án còn mobile/workspace mobile, Redis Compose, script đợi API và check-contract-log; chưa đánh dấu hoàn thành phase 0. Chưa sửa apps/mobile hoặc progress/frontend.md.
- Endpoint mới sẵn sàng: GET /health, chưa kiểm tra DB/Redis.
- Thay đổi contract: mục `2026-10-10 · foundation · ADDED` trong CONTRACT_CHANGES.md; frontend chưa tích hợp.
- Bị chặn bởi: không cho phần API hiện tại; repo chưa khởi tạo Git nên chưa có diff/commit để kiểm tra contract log.
- Việc tiếp theo: frontend tích hợp shared và health; hoàn tất các mục setup còn lại; chạy AI spike 0A trước try-on. Auth, Neon/Prisma và Redis/BullMQ thuộc giai đoạn 1, chưa triển khai.

## 2026-10-10 · Tổ chức tài liệu roadmap
- Đã xong: tách roadmap thành các file giai đoạn 0, 0A, 1–5 và backlog sau MVP trong `packages/docs/roadmap/`; thêm kết quả sản phẩm, checklist, demo và tiêu chí hoàn thành; cập nhật tổng quan và README.
- Đang dở: chưa triển khai tính năng trong phiên này.
- Endpoint mới sẵn sàng: không có.
- Thay đổi contract: không có.
- Bị chặn bởi: không; quyết định cần chốt trước từng phần được ghi trong file phase.
- Việc tiếp theo: đối chiếu code với checklist giai đoạn 0; trạng thái hiện tại phía trên chưa được xác minh bằng code trong phiên này.
