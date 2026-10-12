# API AI Stylist

Backend NestJS cho BE-01/BE-02/BE-03. Node 24 và npm 11; chạy lệnh cài đặt từ gốc repo để link `@stylist/shared`.

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

File `.env.example` có đủ biến HTTP, Neon/Prisma, Redis, Clerk, ImageKit và OpenAI. BE-02 sử dụng ba biến IMAGEKIT và OPENAI_API_KEY/VISION_MODEL/EMBEDDING_MODEL. Thiếu cấu hình provider thì upload trả 503 hoặc job phân tích chuyển failed; OPENAI_IMAGE_MODEL dành cho try-on sau này. Secret webhook chưa cấu hình thì route webhook trả 503.

`DATABASE_URL` là URL pooled dùng cho truy vấn API/worker. `DIRECT_URL` là URL trực tiếp tới cùng database, dùng cho Prisma CLI/migration. Trong Neon Console > Connect, giữ nguyên branch/database/role rồi lấy một URL có bật connection pooling và một URL tắt pooling. Host pooled có `-pooler`; host direct không có hậu tố đó. Giữ các tham số SSL mà Neon cung cấp. Hai biến là hai đường kết nối, không phải hai database khác nhau. Prisma runtime đọc DATABASE_URL; prisma.config.ts đọc DIRECT_URL cho migration. Xem [Prisma database connections](https://www.prisma.io/docs/orm/v7/prisma-client/setup-and-configuration/databases-connections).

## Kiểm tra và build

```powershell
# Từ gốc repo; hiện chỉ kiểm tra API và shared
npx turbo build test lint --filter=api --filter=@stylist/shared
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


## BE-02: upload và phân tích

1. Gọi `GET /uploads/auth` với Bearer token Clerk. Parse `UploadAuthResponse` từ shared. Grant có hiệu lực 10 phút, đăng ký một ảnh một lần.
2. Upload trực tiếp ImageKit V1 với token/expire/signature/publicKey, **folder đúng như response và isPrivateFile=true**. Không upload công khai; backend sẽ từ chối đăng ký. File phải là ảnh, tối đa 10 MiB.
3. Gọi `POST /model-photos` hoặc `POST /garments` với `{ imagekitFileId, url, uploadToken: auth.token }`. Không gửi userId. API xác minh metadata ImageKit và folder của grant trước khi lưu; HTTP 201 trả resource pending.
4. Poll `GET /model-photos/:id` hoặc `GET /garments/:id` đến ready/failed. Worker analysis chạy cùng tiến trình API, concurrency 2, tối đa 2 lần thử. Đầu ra AI sai schema kết thúc failed. Ảnh người mẫu có errorCode riêng cho nhiều người, không toàn thân, không phù hợp hoặc không đủ chất lượng.
5. Danh sách trả `{ items, nextCursor }`, `limit` mặc định 20, tối đa 50; garments nhận thêm category. DELETE theo id xóa file rồi bản ghi. Nếu ImageKit lỗi, giữ bản ghi để thử xóa lại.

Ảnh trả về dưới dạng URL signed có hạn 15 phút, ảnh xem rộng 1600px và thumbnail 400px. Fetch lại resource để làm mới URL; không lưu URL dài hạn. DB chỉ giữ filePath/fileId. Tags phân loại hai cấp và slot; `tryOnAllowed=false` cho underwear/swimwear/sleepwear. Chặn POST /try-on sẽ làm ở BE-03. Ảnh mặc định do mobile quản lý state, chưa có API đặt mặc định.

Nếu enqueue lỗi, API trả 503 và resource đã lưu chuyển failed; tải lại danh sách trước khi quyết định upload mới. Upload bị bỏ dở/chưa đăng ký có thể để lại file trên ImageKit; dọn orphan/grant cũ thuộc BE-05. Redis cho BullMQ production cần noeviction và persistence phù hợp; không tự thay chính sách instance dùng chung.

Sau build, từ apps/api:

```powershell
node scripts/check-wardrobe-db.cjs
# Kiểm tra live có một upload ảnh tổng hợp và gọi AI tính phí; tự dọn fixture.
node scripts/check-wardrobe-live.cjs
```

DB self-check luôn rollback. Live smoke dùng danh tính fixture chỉ trong TestingModule, không thêm auth bypass vào ứng dụng.

## BE-03: thử đồ nội bộ

`POST /try-on` yêu cầu Bearer token và header `Idempotency-Key` (8–128 ký tự chữ/số/gạch nối/gạch dưới). Body theo `CreateTryOnRequest`:

```json
{
  "modelPhotoId": "UUID-của-ảnh-người-mẫu-ready",
  "garmentIds": ["UUID-của-món-ready"],
  "occasion": "Đi làm"
}
```

Response 201 `{jobId}`; cùng key cùng payload trả job cũ, khác payload trả 409 IDEMPOTENCY_CONFLICT. Mỗi thao tác giữ key khi retry; tạo lại chủ động dùng key mới. Kiểm tra ownership/ready và tags an toàn trước tạo job, rồi kiểm tra lại trong worker. Underwear/swimwear/sleepwear không được try-on. Chưa kiểm tra xung đột slot; người dùng tự chọn 1–4 món.

`GET /try-on/:id` trả `TryOnJobResponse`: id/status/provider/createdAt/resultUrl/errorCode/outfitId. Poll queued/processing đến done/failed. Khi done, URL ảnh private có chữ ký 15 phút; GET lại để làm mới. Outfit được tạo một lần, advice và savedAt chưa có giá trị; chức năng lưu lookbook thuộc BE-04.

- `TRYON_PROVIDER=openai` (mặc định): OpenAI Images edits với OPENAI_IMAGE_MODEL, tối đa 5 ảnh tham chiếu resize, một ảnh PNG 1024x1536 quality medium. Key/model hiện có giữ nguyên. Adapter theo [OpenAI Docs: Image generation](https://developers.openai.com/api/docs/guides/image-generation); chất lượng try-on thật chưa nghiệm thu phase 0A.
- `TRYON_PROVIDER=fake`: một PNG mock cố định, không gọi OpenAI. Chỉ local/test, bị từ chối khi NODE_ENV=production. Response provider=fake để UI báo rõ.
- Worker cùng tiến trình API, concurrency 1; 3 attempts cho lỗi an toàn (reference fetch trước AI, HTTP 429). Nội dung bị từ chối không retry. Timeout/network/5xx sau AI có thể đã tạo ảnh hoặc tính phí, nên failed thay vì tự gọi lại. Marker generation và checkpoint file bảo vệ chạy lại; không bảo đảm exactly-once ở provider khi mất kết nối.
- Job có deadline 15 phút; sweep mỗi phút và khi startup, GET cũng kiểm tra quá hạn. DB unavailable thì không thể cập nhật trạng thái đến khi DB hồi phục. File kết quả dùng tên job cố định và không ghi đè; outfit + done ghi cùng transaction.
- UsageService reserve/refund hiện là hooks chưa có quota, refund đánh dấu một lần. Chỉ chạy nội bộ trước BE-05. Redis noeviction/persistence và orphan cleanup vẫn cần hoàn thiện trước production.

Thử toàn luồng không gọi AI, từ apps/api sau build/migrate:

```powershell
node scripts/check-try-on-live.cjs
```

Script dùng identity fixture trong TestingModule, Neon/Redis/ImageKit thật; seed ảnh/món đã phân tích vào DB, kiểm tra concurrent idempotency, ownership, signed/private result, hạn chế trang phục, input chưa ready, sweep timeout và reserve/refund một lần. Tự dọn fixture/file/job. Đây là kiểm chứng cơ chế, không chứng minh chất lượng ảnh thử đồ.

Để chạy fake với mobile: đặt TRYON_PROVIDER=fake trong môi trường lần chạy hoặc .env local, rồi khởi động backend trước bằng launcher hiện có. Không ghi IP cố định; npm run dev vẫn lấy LAN hiện tại và chờ health trước Expo.


## Tủ đồ AI và hình ma nơ canh — nội bộ

`ASSET_GENERATION_ENABLED=false` mặc định. Local bật `ASSET_GENERATION_ENABLED=true`; production bắt buộc thêm `ASSET_GENERATION_USER_IDS` là UUID nội bộ từ GET /me, phân cách bằng dấu phẩy. `ASSET_PROVIDER=openai` dùng key/model hiện có; fake chỉ dev/test, UI phải ghi rõ mock. Không sửa IP cố định: launcher vẫn chọn LAN mỗi lần chạy và chờ API trước Expo.

- Từ ảnh: một món/pair mỗi ảnh, chọn loại và crop nếu đang mặc. POST /garments thêm `generateAsset:true, bodyKey:m|f, requestedType`. Analysis hoàn tất mới tự xếp job tạo PNG; hết lượt/lỗi vẫn giữ món gốc. Nếu requestedType khác phân loại, không gọi image generation, user cần ảnh rõ hơn.
- Từ ý tưởng: POST /garment-ideas nhận IdeaRequest (menu/type/prompt/bodyKey), GET /garment-ideas/:id trả đề xuất tối đa 4 món. Chỉ tạo ảnh sau khi user xác nhận POST /garment-asset-jobs với items 1–4. POST cả hai luồng bắt buộc Idempotency-Key. GET /garment-asset-jobs/:id theo dõi queued/processing/ready/failed. Garment mới có source=ai_concept, không giả thành quần áo người dùng sở hữu.
- GET /asset-generation/quota: 5 ảnh/ngày/user chung photo/idea, 10 lần gợi ý/ngày; reset 00:00 Asia/Saigon. Khóa user trong transaction giữ quota và idempotency khi gọi đồng thời. Lỗi chắc chắn chưa tạo ảnh hoàn lượt; timeout/mất receipt giữ lượt và không gọi image AI lại. Lần gợi ý đã bắt đầu vẫn tính trong cap 10 dù thất bại. Analysis ảnh gốc chưa thuộc quota này.
- PNG chuẩn hóa alpha, bounds=[left,top,width,height], khung 1024x1536 cho trang phục hoặc 1024x1024 cho phụ kiện. URL private ký 15 phút, format PNG giữ alpha; GET lại để làm mới. Mỗi garment hiện trả một mannequinAsset: biến thể mới thay ảnh hiện tại; file cũ giữ trong jobs và xóa cùng garment. Deferred không tự chạy lúc ngày mới, user bấm tạo hình.
- Worker concurrency 1, deadline 15 phút, sweep mỗi phút; checkpoint phục hồi finalize không tạo lại ảnh. DELETE tombstone trước xóa file, job chậm không hồi sinh món. Timeout upload/checkpoint có thể để file orphan; reconciliation/purge thuộc BE-05. Redis allkeys-lru cần đổi sang noeviction/persistence trước production.

Bộ mẫu: packages/shared/assets/wardrobe (18 món) + formalwear (4 bộ), manifest có demoOnly; không cấp Garment ID và không gửi mẫu lên try-on. Claude tích hợp apps/mobile: crop/upload/ý tưởng, polling hữu hạn, ảnh chính diện và proxy 3D khi xoay. PNG không phải mesh/UV hay bản mô phỏng độ vừa thật.

Sau build/migrate, từ apps/api:

```powershell
# DB/Redis/ImageKit thật, fake AI, tự dọn fixture:
node scripts/check-assets-live.cjs
# Có tính phí: tối đa 2 lượt image AI, ảnh tham chiếu tổng hợp, tự dọn file cloud:
node scripts/check-assets-provider.cjs
```

Provider smoke đã tạo áo từ ảnh và nhẫn từ ý tưởng bằng model hiện có, xác nhận alpha và signed ImageKit PNG; report cục bộ trong .artifacts/mannequin-smoke. Không thay thế nghiệm thu ảnh người dùng, thiết bị hoặc đo chi phí production.
