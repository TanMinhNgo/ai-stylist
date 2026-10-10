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

File `.env.example` có đủ biến theo kiến trúc hiện tại: HTTP, Neon/Prisma, Redis, Clerk, ImageKit và OpenAI. BE-01 sử dụng DATABASE_URL, REDIS_URL, CLERK_SECRET_KEY, CLERK_WEBHOOK_SECRET và CLERK_AUTHORIZED_PARTIES. ImageKit/OpenAI chưa tích hợp. Secret webhook chưa cấu hình thì route webhook trả 503, không xử lý dữ liệu.

`DATABASE_URL` là URL pooled dùng cho truy vấn API/worker. `DIRECT_URL` là URL trực tiếp tới cùng database, dự kiến dùng cho Prisma CLI/migration. Trong Neon Console > Connect, giữ nguyên branch/database/role rồi lấy một URL có bật connection pooling và một URL tắt pooling. Host pooled có `-pooler`; host direct không có hậu tố đó. Giữ các tham số SSL mà Neon cung cấp. Hai biến là hai đường kết nối, không phải hai database khác nhau. Cấu hình Prisma cụ thể sẽ được nối vào hai biến khi làm BE-01 theo phiên bản cài đặt; biến env chưa tự có tác dụng khi chưa được code sử dụng. Xem [Prisma database connections](https://www.prisma.io/docs/orm/v7/prisma-client/setup-and-configuration/databases-connections).

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

BE-01 đã thêm Neon/Prisma, Clerk và nền Redis/BullMQ. API kiểm tra kết nối DB (bao gồm bảng users) và Redis trước khi mở cổng; launcher vì vậy không mở mobile khi dependency chưa sẵn sàng. `/health` vẫn là liveness sau khởi động, chưa theo dõi dependency liên tục. Không chạy build và dev đồng thời vì Nest build dọn dist.

## Thiết lập BE-01

1. Điền `.env` theo file mẫu. `CLERK_AUTHORIZED_PARTIES` mặc định rỗng cho app Expo native, độc lập với `CORS_ORIGINS`. Token native không có azp vẫn phải qua kiểm tra chữ ký, thời hạn và session. Khi API chỉ phục vụ web, đặt danh sách frontend origins rõ ràng; Clerk SDK sẽ yêu cầu azp khớp danh sách và từ chối cả token không có azp. Không điền browser origins vào cấu hình native hoặc dùng API origin thay cho frontend origin.
2. Nếu dùng Redis local: mở Docker Desktop, từ gốc repo chạy `docker compose up -d redis`, rồi đặt REDIS_URL=redis://localhost:6379 trong `.env`. Redis chỉ bind loopback máy, điện thoại gọi API chứ không kết nối Redis. Nếu dùng cloud, giữ URL provider thực sự phân giải/truy cập được; rediss dùng TLS.
3. Chạy `npm run db:validate --workspace api` và `npm run db:migrate --workspace api`. Migrate deploy dùng DIRECT_URL, không tạo shadow database hoặc reset dữ liệu. Chỉ chạy trên database/branch bạn định dùng.
4. `npm run build --workspace api` generate Prisma client rồi build Nest. Client generated không commit, Turbo cache bao gồm cả client và dist. Sau build có thể chạy `node scripts/check-user-sync.cjs` từ apps/api để kiểm tra thật trên DB; mọi fixture nằm trong transaction rollback.
5. Chạy `npm run dev` hoặc `npm run dev:api`. Auth mặc định cho route nghiệp vụ; GET /health public; GET /me nhận Authorization: Bearer <Clerk session token>. Response theo MeResponse, email có thể null.

Webhook: tạo endpoint HTTPS trỏ tới `/webhooks/clerk` trong Clerk Dashboard, đăng ký user.created/updated/deleted, đặt signing secret vào CLERK_WEBHOOK_SECRET. LAN URL không nhận được webhook từ Clerk trên internet; local cần public HTTPS forwarding do bạn cấu hình. Nest giữ raw body để verify Svix signature; sự kiện không hợp lệ bị từ chối trước DB. Event lặp và cũ không ghi đè dữ liệu mới; user.deleted scrub email và giữ tombstone tối thiểu chống phục hồi. Toàn bộ purge dữ liệu/ảnh làm ở BE-05.

Log dùng ConsoleLogger JSON, mỗi request có x-request-id; không ghi Authorization, token, email, URL đầy đủ hoặc body. Test thường mock DB/Redis/Clerk; có test chữ ký dùng SDK thật và secret sinh trong test, không gọi mạng.

