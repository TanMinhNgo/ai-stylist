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

## BE-04: stylist cá nhân và lookbook

Migration `202610140004_stylist` bổ sung StyleProfile, StylistJob và metadata/vector outfit. Chạy `npm run db:migrate -w api` trước API trên môi trường mới. `STYLIST_PROVIDER=openai` dùng OPENAI_VISION_MODEL và key hiện có; fake chỉ dùng test/dev, bị cấm production.

- GET/PUT `/style-profile`: style, dịp, budget VND, màu thích/tránh, bodyShape/skinTone. Khi chưa lưu, suy ra từ ảnh model đã phân tích gần nhất; PUT thiếu hai trường AI giữ giá trị hiện tại, null chủ động xóa.
- GET `/outfits?limit=20&cursor=UUID&liked=true`: chỉ outfit đã lưu; bỏ liked để xem tất cả, false để xem không thích. GET `/outfits/:id` lấy chi tiết/ảnh ký hạn 15 phút.
- POST `/outfits/:id/save` với `{saved:true|false}`; POST `/outfits/:id/feedback` với `{liked:true|false|null}`; DELETE `/outfits/:id` tombstone trước khi xóa ảnh để worker không hồi sinh dữ liệu.
- POST `/outfits/:id/advice` và POST `/stylist/suggest` (`{occasion}`) cần Idempotency-Key, trả `{jobId}`. GET `/stylist/jobs/:id` poll tới ready/failed. Cùng key/payload trả cùng job; key mới khi advice đang chạy trả 409 IDEMPOTENCY_CONFLICT. Retry sau lỗi mạng giữ key; tác vụ mới chủ động dùng key mới.

Try-on hoàn thành tự enqueue advice; lỗi tư vấn giữ nguyên ảnh. Outfit có adviceStatus/adviceErrorCode, promptVersion/knowledgeVersion và adviceIsMock riêng với isMock của ảnh. Tư vấn structured có schema và thử lại một lần nếu sai schema. Worker concurrency 1, deadline 5 phút, không tự phát lại AI sau khi đã bắt đầu gọi provider.

Gợi ý trả tối đa 3 tổ hợp garmentIds/reason và message khi thiếu đồ. Lọc ownership/ready/allowed trước và sau AI; GET job loại tổ hợp chứa món đã xóa. Mobile vẫn đọc lại garment trước khi áp dụng Studio. Taste vector tính lại từ tối đa 50 feedback, decay 30 ngày, dislike trọng số -0.25; feedback trùng không cộng dồn. Candidate pgvector giới hạn 60 món theo dịp. Ngân sách chỉ là sở thích, chưa có dữ liệu giá sản phẩm.

Kiểm tra bổ sung sau build: `node scripts/check-stylist-live.cjs` tại apps/api dùng Neon/ImageKit thật, fake AI và dispatch trong bộ nhớ, tự dọn fixture. `node scripts/check-stylist-provider.cjs` gọi OpenAI thật, có phát sinh phí; không nằm trong test suite mặc định. Quota/rate limit toàn bộ AI và purge tài khoản thuộc BE-05; hiện chỉ thử nội bộ.

Redis phải sẵn sàng trước khi khởi tạo BullMQ. Nếu log báo public IP không nằm trong allowlist, kiểm tra Networking của Render theo mạng đang dùng. Không ghi cứng IP LAN vào env; launcher tự chọn IP và chờ API healthy trước Expo.

## BE-05: quota, billing và quyền riêng tư

`GET /usage` yêu cầu session: `{plan,limit,used,remaining,resetsAt}`. Hạn mức tháng UTC chỉ dành cho try-on, mặc định hiện tại Free5/Plus20/Pro60 từ BE-06.1 (trước đó5/50/200), điều chỉnh qua USAGE_*_LIMIT. Ledger `-1` được ghi cùng transaction tạo job dưới khóa user; `+1` chỉ ghi một lần nếu job thất bại, tham chiếu tháng reserve kể cả refund sang tháng sau. Auto advice không trừ thêm lượt try-on; mannequin quota ngày vẫn riêng. Job cũ trước migration chưa có debit không nhận credit miễn phí.

PlanSource đọc subscription bằng Clerk backend SDK, cache Redis tối đa60giây; item canceled chỉ còn quyền tới periodEnd, upcoming/past_due/ended không mở quyền. Webhook subscription/subscriptionItem chỉ invalidate sau verify Svix; version cache tránh stale fill sau invalidation. Chưa bật Clerk Billing thì CLERK_BILLING_ENABLED=false dùng Free. Khi bật cần slug đúng, webhook Billing và gói thật được kiểm chứng. Client không gửi plan; Pro dùng priority1, job khác10. Receipt cùng key vẫn trả job cũ nếu Billing/cache gặp sự cố.

Nguồn Clerk: [getUserBillingSubscription](https://clerk.com/docs/reference/backend/billing/get-user-billing-subscription), [subscription webhooks](https://clerk.com/docs/expressjs/guides/development/webhooks/billing). Không dùng metadata client để nâng gói. Kiểm tra read-only ngày2026-10-15 trả403 billing_not_enabled; Plus/Pro đã test bằng fake PlanSource, chưa nghiệm thu quyền trả phí thật.

Các POST AI và GET /uploads/auth dùng Redis atomic rate limit chung theo user, mặc định10/minute; mọi loại job user tối đa4 queued/processing (asset batch tính cả số món). RATE_LIMITED429 có details.retryAfterSeconds, QUOTA_EXCEEDED429 có details.resetsAt. Redis lỗi/timeout failclosed503. Analysis quá15phút không gọi AI mới. Worker cần DB schema mới: `npm run db:migrate -w api`.

`DELETE /me` trả202 `{deletionId,status}`, khóa tài khoản/scrub email ngay rồi queue privacy dọn nền. DELETE lặp với session còn hợp lệ trả cùng receipt; GET /me/deletion xem trạng thái. Clerk có thể revoke session trước khi purge xong, khi đó token trả401. DB receipt và sweep mỗi phút khôi phục sau enqueue/storage lỗi, không giả completed. Queue payload chỉ ID.

Purge chờ worker leases hoàn thành và chữ ký upload đã cấp hết hạn (+2phút settle); có thể12–20phút hoặc lâu hơn khi provider lỗi. Xóa Clerk, tất cả ImageKit IDs đã lưu và orphan theo đúng /stylist/{userId}/, rồi xóa tables nghiệp vụ theo thứ tự FK. Worker/finalize khóa user và kiểm tra deletedAt; không khôi phục dữ liệu từ webhook cũ. Giữ user ID/Clerk ID/deletedAt và deletion receipt tối thiểu để ngăn resurrection; ảnh đã tải/chia sẻ ra thiết bị, log vận hành và retention nội bộ provider cần chính sách riêng, không hứa xóa bản sao người nhận. API không xóa tài khoản thật trong smoke.

WorkLease bao phủ worker đến hết checkpoint/upload, heartbeat1phút, lease crash hết hạn20phút. AiCall ghi từng SDKcall (vision/embedding/image/stylist), usage và estimatedUsd. AI_COST_RATES_JSON là bảng giá theo model, input/output USD/1triệu token; thiếu usage/giá hoặc thất bại receipt mơ hồ = null/unknown, không phải miễn phí. Giá ảnh/token có thể cần rate tổng hợp riêng theo cấu hình hiện tại; chưa hiệu chuẩn chi phí USD, chưa mở bán gói. Telemetry lỗi không bỏ kết quả đã trả phí để gọi AI lại.

Sau build, `node scripts/report-ai-costs.cjs YYYY-MM-DD [userUUID]` tại apps/api thống kê UTC theo user/job, tối đa1000 hàng, không in prompt/URL/email/token. `node scripts/check-usage-live.cjs` kiểm tra Neon/Redis/ImageKit thật với fake identity/billing/AI, dispatch trong bộ nhớ; fixture được dọn. Bao gồm race lượt cuối, refund lặp/qua tháng, Propriority giả, rateLua, concurrency cap, purge đợi worker/upload/failedstorage/orphan/tombstone. Không kiểm chứng vận chuyển BullMQ/privacy job thực hoặc xóa Clerk thật bằng script này.

`node scripts/check-privacy-queue-live.cjs` (từ `apps/api`, sau build) kiểm tra riêng privacy qua BullMQ thật trên Redis, Neon và ImageKit hiện cấu hình. Script dùng namespace hàng đợi ngẫu nhiên, chỉ tạo/xóa user và ảnh fixture; không chạy worker AI hoặc xóa tài khoản Clerk thật. Kiểm tra receipt HTTP202/idempotency, job tồn tại qua khởi động lại worker, lease/upload grant chặn purge, lỗi storage rồi recovery sweep, xóa ảnh đã tham chiếu/orphan, cách ly user khác, tombstone, replay và payload sai. Chỉ thời điểm retry/expiry của fixture được tiến lên để tránh chờ nhiều phút; không chứng minh thời gian chờ thực tế, Clerk session/deletion hoặc paid billing. Không chạy đồng thời với build vì script đọc `dist`; cuối lượt dọn fixture và namespace riêng, không xóa queue ứng dụng.

Kiểm kê orphan dùng `path : "/stylist/{userId}/" AND type = "file"`. Toán tử `:` đã bao gồm thư mục con; thêm `*` làm truy vấn trả rỗng dù còn ảnh. Khi dùng `searchQuery`, lọc `type` phải nằm trong truy vấn để loại folder. Mỗi lượt lấy tối đa100 file, purge xóa batch rồi kiểm kê lại và defer nếu còn. Xem [ImageKit: toán tử tìm kiếm và path](https://imagekit.io/docs/api-reference/digital-asset-management-dam/list-and-search-assets#supported-parameters).

Inventory ImageKit trong live smoke có độ trễ sau upload/delete. Script đợi ảnh fixture xuất hiện trước khi bắt đầu, chạy startup sweep một lần rồi drive recovery sweep chủ động; chỉ kết luận xóa file sau khi đọc theo ID trả404. Kết quả này không bảo đảm inventory thấy ngay upload có receipt mơ hồ hoặc lịch chạy/độ trễ production. Clerk thật, CDN/provider retention và chi phí USD vẫn cần nghiệm thu riêng.

## BE-06.1: quyền gói và quota

Quota mặc định hiện là **Free5/Plus20/Pro60**, cấu hình bằng USAGE_*_LIMIT; `.env.example` đã cập nhật, `.env` local chỉ đổi hai con số Plus/Pro và giữ `CLERK_BILLING_ENABLED=false`. Đây là giới hạn thử nghiệm nội bộ, không xác nhận giá hoặc tổng chi phí AI đã phù hợp để mở bán. Ledger không reset khi đổi gói: downgrade có thể để used lớn hơn limit, remaining về0 và chặn job mới; refund vẫn về tháng reserve ban đầu.

`GET /usage/entitlements` yêu cầu Bearer session, user lấy từ token; không nhận plan/feature/userId từ client. Schema `EntitlementsResponse` trong shared trả:

```json
{
  "plan": "plus",
  "includedFeatures": ["digital_wardrobe", "ai_styling", "personal_lookbook", "monthly_try_on_20", "advanced_outfit_advice", "accessory_recommendations", "occasion_collections"],
  "availableFeatures": ["digital_wardrobe", "ai_styling", "personal_lookbook", "monthly_try_on_20", "advanced_outfit_advice", "accessory_recommendations", "occasion_collections"],
  "tryOn": { "limit": 20, "period": "calendar_month_utc", "resetsAt": "2026-11-01T00:00:00.000Z" }
}
```

`includedFeatures` là quyền lợi mục tiêu của plan; **`availableFeatures` xác nhận backend đã triển khai**. Plus/Pro có advanced advice/phụ kiện và occasion_collections; Pro có planner/insights từ6.4–6.5 và priority_queue. Mobile cần tích hợp từng contract riêng. Nếu override quota khác số catalog, feature monthly_try_on tương ứng không nằm trong availableFeatures; đọc tryOn.limit hoặc GET/usage cho số lượt thực. GET/usage giữ nguyên strict response cũ, không thêm field làm hỏng mobile hiện có.

`UsageService.requireFeature(userId, feature)` dùng cùng policy, từ chối bằng FORBIDDEN403 với details `{feature,reason:not_included|not_available}`; create/edit collections, planner và insights sử dụng helper này. Chu kỳ quota AI vẫn **tháng lịch UTC**, độc lập ngày gia hạn Clerk; client phải hiển thị resetsAt, không hứa reset theo ngày thu tiền. Ngày planner/wear là ngày local do request ghi rõ timezone, không dùng chu kỳ quota này.

Shared `PLAN_FEATURES` và `PLAN_TRY_ON_LIMITS` là policy; `CLERK_FEATURE_SLUGS` ánh xạ mã API tiếng Anh sang12slug tiếng Việt đã tạo trong Clerk. Không đổi slug trên Clerk hoặc tin feature client gửi. PlanSource vẫn đọc subscription đã xác thực phía server, cache tối đa60giây và invalidate qua webhook Svix. Bật Billing là thao tác cấu hình riêng sau nghiệm thu quyền thật/chi phí; không suy quyền trả phí từ việc plan catalog tồn tại.

Khi Billing tắt, PlanService trảFree sau kiểm tra user còn hoạt động và bỏ qua cache paid/nguồn subscription; cachePro cũ không thể mở lại quyền. Trong check-usage-live.cjs, riêng tiến trình fixture đặt Billing=true để kiểm tra luân chuyển plan nhưng thay toàn bộ PlanSource bằng fake; không bật Billing trong .env hoặc đọc subscription trả phí thật.

Sau build, `node scripts/check-usage-live.cjs` còn kiểm tra read-only catalog Clerk thật và mapping12feature, upgrade/downgrade trên Neon/Redis, entitlements, quota và purge fixture. Identity/subscription vẫn fake, dispatch trong bộ nhớ; grant/retry timestamp chỉ tiến cho fixture. Script không mua gói, không đổi Clerk, không gọi AI. Inventory có thể cập nhật trễ nên script đợi thấy fixture và đợi metadata404 sau purge.

## BE-06.4–6.5: planner, xác nhận đã mặc và insights

Migration `202610170007_planner_wear` thêm2bảng/index/FK; local đã apply, môi trường khác chạy migrate deploy trước sử dụng. Không có AI/queue hoặc ảnh mới trong các route này. Mọi route yêu cầu Bearer và shared schema strict.

| Method | Route | Input | Quyền |
|---|---|---|---|
| GET | /planner/week | query `{startDate,timeZone}` | Mọi gói, dữ liệu của mình |
| PUT | /planner/days/:date | `{timeZone,occasion,outfitId:uuid|null}` | Pro |
| DELETE | /planner/days/:date | query `{timeZone}` | Mọi gói |
| PUT | /wear-history/:id | `{date,timeZone,outfitId}` | Mọi gói |
| GET | /wear-history | query `{from,to}` | Mọi gói |
| DELETE | /wear-history/:id | UUID | Mọi gói |
| GET | /wardrobe/insights | query `{from,to}` | Pro |

Ngày YYYY-MM-DD thật, timezone IANA/UTC được canonicalize, không nhận offset tự do. Planner trả đủ7slot liên tiếp từ startDate; Pro ghi từ hôm nay đến365ngày tới theo timezone, cap730slot/user. PUT cùng user/timezone/date thay slot, không nhân bản; xóa slot idempotent. Slot trống, slot chưa chọn outfit và slot thiếu outfit/garment được phân biệt bằng isPlanned/outfitId/outfitUnavailable. Hết Pro vẫn xem/xóa archive. Không ép ngày bắt đầu tuần hoặc chuyển ngày khi đổi timezone.

Nút “Đã mặc” phải là xác nhận riêng, không tự kích hoạt từ try-on/save/like/planner. UUID wear do client tạo và giữ nguyên khi retry. Cùng ID/body trả receipt cũ; khác body hoặc khác UUID nhưng cùng outfit/ngày trả409. Cho ghi hôm nay hoặc365ngày trước, tối đa5record/ngày/user; từ lúc ghi giữ snapshot tối đa4garment IDs. Xóa outfit setnull tham chiếu nhưng giữ lịch sử xác nhận; xóa wear record sẽ thay đổi thống kê. Xóa record rồi PUT lại là xác nhận mới có chủ đích.

History và insights theo kỳ bao gồm hai đầu <=366ngày (history tối đa1830record). Insights chỉ dựa vào xác nhận, không suy từ lượt click:0record trả insufficient_data; món0lượt nghĩa chưa có ghi nhận trong kỳ. Chỉ đếm garment hiện ready/chưa xóa; top/least tối đa10/phần, gợi ý tối đa3outfit saved sẵn trong200bộ gần nhất còn đầy đủ đồ. Không sinh outfit/ảnh hoặc dùng LLM.

Schemas/fields/error đầy đủ tại `packages/docs/CONTRACT_CHANGES.md`, mục planner-wear-insights. Quota dữ liệu429 có resource planner (730) hoặc wear_history (5), không phải hết lượt AI. Foreign/missing outfit hoặc garment404, schema/date400, thiếu Pro403. User row lock và composite FK bảo vệ ownership/cap/tombstone; purge xóa hai bảng mới trước outfit.

## BE-06.6: bằng chứng nghiệm thu

Sau build: chạy check-stylist-live.cjs (bao gồm planner/history/insights), check-privacy-queue-live.cjs và check-usage-live.cjs tại apps/api. Chỉ dùng user/ảnh fixture, identity/plan/AI fake; Neon/Redis/ImageKit và Clerk catalog là thật. Không chạy cùng build đang xóa dist. Sau khi fixture đã cleanup, `node scripts/report-phase6-readiness.cjs` đọc catalog/subscription của tối đa20active account, tổng AiCall/cost và inventory, không in user ID/secret/prompt hoặc mua gói. Output giữ paidReleaseAccepted=false: evidence read-only không thay thế giao dịch thực/webhook delivery, economics hoặc nghiệm thu thiết bị. Snapshot và tiêu chí còn thiếu ở `packages/docs/roadmap/phase-06-acceptance.md`.

## BE-06.3: bộ sưu tập theo dịp

Chạy `npm run db:migrate -w api` trước API trên môi trường mới; migration202610160006_collections chỉ thêm2bảng/index/FK, không reset dữ liệu cũ. Local Neon đã apply và đối chiếu counts trước/sau. Collections không gọi AI hoặc sao chép ảnh.

| Method | Endpoint | Body/query | Response |
|---|---|---|---|
| POST | /collections | `{name,occasion,outfitIds?:uuid[]}` | 201 CollectionResponse |
| GET | /collections | `limit=20&cursor=uuid` | CollectionListResponse |
| GET | /collections/:id | UUID | CollectionResponse |
| PATCH | /collections/:id | `{name?,occasion?,outfitIds?}` | CollectionResponse |
| DELETE | /collections/:id | UUID | `{deleted:true}` |

Bearer Clerk bắt buộc; user lấy từ token. Plus/Pro có `occasion_collections` để tạo/sửa; sau downgrade vẫn đọc/list/xóa archive. Schema strict trong shared: tên trim1..80, dịp trim1..120, tối đa50collection/user và50UUID outfit khác nhau/collection; PATCH phải có ít nhất1trường. Gửi outfitIds thay toàn bộ danh sách (`[]` làm rỗng), không gửi thì giữ nguyên. Outfit phải cùng owner và chưa xóa, không bắt buộc savedAt. Không tự save/unsave outfit. POST mỗi lần tạo mới, không có receipt idempotency; tránh tự retry khi chưa đối chiếu danh sách sau mất mạng.

CollectionResponse là `{id,name,occasion,outfitIds,createdAt,updatedAt}`; List là `{items,nextCursor}`. UUID outfit tăng dần, không hứa thứ tự nhập. List theo createdAt DESC/id DESC, limit1..50; cursor phải thuộc owner. URL/detail ảnh đọc qua GET/outfits/:id hiện có, không có ảnh bản sao trong collection. Xóa collection giữ outfit/ảnh; xóa outfit tự bỏ link, client cần invalidate collections. Composite FK scope user và khóa User bảo vệ liên kết/limit/tombstone; purge account xóa collection và memberships trước outfit.

Lỗi:400validation/unknown fields/duplicate/empty patch;401auth;403FORBIDDEN khi create/edit thiếu feature;404collection/cursor/outfit lạ, foreign hoặc deleted;429QUOTA_EXCEEDED details `{resource:"collections",limit:50}`. Sai một outfit rollback toàn bộ mutation. Không trừ quota try-on/stylist.

Kiểm tra sau build: check-stylist-live.cjs thêm CRUD/gate/downgrade/ownership/composite FK/atomicity/cursor/cap race/unlink trên Neon/ImageKit thật với identity/plan/AI fake; check-privacy-queue-live.cjs thêm collection/membership vào purge qua BullMQ thật và giữ collection user khác. Không dùng paid subscription thật hoặc nghiệm thu mobile qua các smoke này. Contract FE xem packages/docs/CONTRACT_CHANGES.md, chưa thay frontend.

## BE-06.2: tư vấn theo gói và quota stylist

`GET /stylist/usage` (Bearer) trả `StylistUsageResponse` riêng, ví dụ:

```json
{"plan":"free","adviceLevel":"basic","limit":10,"used":2,"remaining":8,"period":"calendar_month_utc","resetsAt":"2026-11-01T00:00:00.000Z"}
```

Cap bảo vệ tạm **Free10/Plus60/Pro180 job/tháng UTC**, dùng chung advice tự động sau try-on, POST `/outfits/:id/advice` và POST `/stylist/suggest`. Đây là lượt tư vấn riêng, không trừ quota try-on; chưa hiệu chuẩn theo chi phí, chưa dùng làm cam kết mở bán. Job queued/processing/ready giữ lượt. Failed trước begin giải phóng; sau marker startedAt giữ lượt kể cả lỗi context/provider/receipt mơ hồ. Provider có thể retry lỗi schema một lần trong cùng job, không retry mạng. Không replay job đã started sau crash. Không xóa receipt để hoàn quota; xóa outfit vẫn giữ lịch sử tính lượt.

Các endpoint advice cũ giữ toàn bộ field/request/response. **Hành vi mới:** Free có summary, tối đa2 strengths và occasionFit; adjustments/accessories là `[]`. Plus/Pro có phân tích màu/tỷ lệ trang phục/dịp và gợi ý phụ kiện từ prompt/schema nâng cao. Backend chọn mức từ PlanService trước enqueue và kiểm tra lại trước worker begin; client không gửi level/plan để mở quyền. Downgrade job đang chờ thì basic, upgrade không tự nâng job basic cũ. Job legacy thiếu level chạy basic. Kết quả ghi `promptVersion=stylist-v2-basic|stylist-v2-advanced`; advice đã lưu vẫn đọc sau downgrade. Knowledge/model/key giữ cấu hình hiện có.

Admission và begin dùng khóa User, cùng tháng createdAt của receipt kể cả khi worker qua đầu tháng. Cùng key/payload trả receipt cũ kể cả đầy quota; payload khác vẫn409. Hết cap trước tạo job trả429 `QUOTA_EXCEEDED`, details `{resource:"stylist"}`. Nếu worker bị chặn do cap sau downgrade thì receipt failed/errorCode=QUOTA_EXCEEDED và chưa có startedAt. Auto advice lỗi/quota giữ ảnh try-on. Plan cache tối đa60giây và webhook invalidation giữ nguyên6.1.

Sau build, `node scripts/check-stylist-live.cjs` kiểm tra Neon/ImageKit thật, identity/plan/AI fake và dispatch trong bộ nhớ: Free/Plus/Pro cho kết quả mock khác nhau, downgrade trước worker, giữ dữ liệu paid đã lưu, foreign owner, race lượt cuối, giải phóng trước begin, lỗi mơ hồ vẫn tính một lần, replay khi đầy cap và chặn worker khi hạ gói. Script chỉ dọn fixture của nó, không gọi OpenAI trả phí. Kiểm thử prompt/schema bằng mock không chứng minh chất lượng phân tích ảnh thật hoặc tổng chi phí; paid subscription/webhook và mobile/thiết bị vẫn cần nghiệm thu riêng.
