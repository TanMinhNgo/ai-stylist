# API AI Stylist

Backend NestJS của giai đoạn 0. Node 24 và npm 11; chạy lệnh cài đặt từ gốc repo để link `@stylist/shared`.

## Chạy local

```powershell
# Từ gốc repo
npm install
Copy-Item apps/api/.env.example apps/api/.env
npm run dev
```

Workspace hiện gồm API và shared. `npm run dev` tự lấy IP LAN hiện tại, khởi động backend/shared, kiểm tra `/health` qua IP LAN rồi mới mở Expo ở chế độ LAN. Không ghi cố định IP vào file env. Nếu tiến trình dev backend thoát, launcher dừng cả Expo. Ctrl+C dừng cây tiến trình do launcher tạo.

`npm run dev:api` chỉ chạy backend/shared, không mở Expo. Khi chạy cả hai, launcher truyền `EXPO_PUBLIC_API_URL=http://<IP-LAN-hiện-tại>:<PORT>` và host của Metro vào môi trường Expo. Frontend đọc trực tiếp `process.env.EXPO_PUBLIC_API_URL`; hiện màn hình mobile chưa có logic fetch API.

Nếu máy có nhiều kết nối LAN, đặt IP của interface muốn dùng cho lần chạy đó:

```powershell
$env:LAN_HOST = '<IPv4-của-interface-hiện-tại>'
npm run dev
Remove-Item Env:LAN_HOST
```

Khi đổi Wi-Fi, dừng và chạy lại `npm run dev` để nhận IP mới. Máy và điện thoại cần cùng mạng, mạng cho phép thiết bị kết nối với nhau và firewall cho phép port API/Metro. Launcher không tự thay firewall hay cài dependency mobile; nếu chưa cài thì chạy `npm install --prefix apps/mobile` trước.

API bind `0.0.0.0`, port mặc định 3000; `0.0.0.0` là địa chỉ lắng nghe, không dùng làm URL trên điện thoại. URL LAN cụ thể được in mỗi lần chạy. Mở `<URL-LAN>/health` trong trình duyệt điện thoại để kiểm tra kết nối trước khi debug fetch.

## Contract

`GET /health` trả HTTP 200:

```json
{ "status": "ok" }
```

Mobile import `HealthResponse` từ `@stylist/shared` để parse. Health chỉ xác nhận HTTP service đang sống, chưa kiểm tra database hoặc Redis.

Lỗi có dạng `{ code, message, details? }`, theo `ApiError`. Lỗi 5xx không trả stack/message/details nội bộ. Request validation dùng `ZodValidationPipe(schema)` tại tham số Body/Query/Param khi thêm endpoint; TypeScript type không tự validate đầu vào.

Ví dụ cho controller tương lai:

```ts
@Post()
create(@Body(new ZodValidationPipe(CreateRequest)) body: CreateRequest) {
  return this.service.create(body);
}
```

`CreateRequest` trong ví dụ là schema sẽ được khai báo ở shared khi có nghiệp vụ tương ứng, chưa phải export hiện tại.

## Cấu hình

- `PORT`: mặc định 3000, số nguyên 1–65535.
- `CORS_ORIGINS`: browser origins cách nhau bằng dấu phẩy; bỏ trống thì không bật CORS. Native Expo không cần CORS.
- API đọc `.env` trong thư mục làm việc `apps/api` khi chạy qua workspace script. Không commit `.env`.

## Kiểm tra và build

```powershell
# Từ gốc repo; hiện chỉ kiểm tra API và shared
npx turbo build test lint
node --test scripts/*.test.mjs

# Chạy bản đã build
npm run start:prod --workspace api
```

Test bao gồm schema shared, controller/pipe và HTTP integration: health, 404, validation, malformed JSON, 401, 500/503. Các route `/probe` chỉ tồn tại trong test.

Bộ lọc lỗi đăng ký qua `APP_FILTER`, nên test khởi tạo AppModule cũng dùng cùng xử lý lỗi với API thật. Pipe/filter theo cơ chế [NestJS pipes](https://docs.nestjs.com/pipes) và [exception filters](https://docs.nestjs.com/exception-filters).

## Phần tiếp theo

Giai đoạn 0 toàn dự án còn tích hợp fetch/shared trên mobile, Redis Compose và kiểm tra nhật ký contract bằng Git. `scripts/wait-for-api.mjs` được launcher sử dụng và có thể chạy độc lập với URL API làm tham số. Giai đoạn 1 mới thêm Neon/Prisma, Clerk và Redis/BullMQ. Health hiện chỉ xác nhận HTTP server sống, chưa bảo đảm DB/queue khỏe.

