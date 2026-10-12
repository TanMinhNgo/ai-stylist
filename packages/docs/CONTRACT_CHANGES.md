# Contract Changes

Nhật ký mọi thay đổi trong `packages/shared` và hành vi API. Hai agent đọc file này đầu mỗi phiên.

## Quy tắc

- Mục mới nhất ở trên cùng của phần "Lịch sử".
- Backend ghi mục thay đổi, trong cùng commit với thay đổi ở `packages/shared`.
- Frontend chỉ được: thêm vào "Yêu cầu đang chờ" và tick "Trạng thái FE".
- Nhãn:
  - `ADDED`: thêm mới, không ảnh hưởng bên kia.
  - `CHANGED`: thay đổi nhưng tương thích ngược.
  - `BREAKING`: bên kia phải sửa code.

## Mẫu mục thay đổi

```md
## YYYY-MM-DD · <module> · ADDED | CHANGED | BREAKING
- Bởi: backend
- Thay đổi: <mô tả ngắn, nêu tên schema và trường>
- Endpoint: <METHOD /đường-dẫn>
- FE cần làm: <việc cụ thể, hoặc "không">
- Trạng thái FE: [ ]
```

## Mẫu yêu cầu

```md
- [ ] YYYY-MM-DD · <module> · <điều cần thêm hoặc đổi> · Lý do: <màn hình hoặc luồng nào cần>
```

---

## Yêu cầu đang chờ

_Frontend ghi ở đây. Backend làm xong thì xóa dòng và thêm mục tương ứng vào "Lịch sử"._

- [ ] 2026-10-12 · garments · Đối chiếu danh sách GarmentType đầy đủ với bảng thiết kế UI; backend đã có category/type/slot và các tag theo yêu cầu, nhưng chưa đọc được toàn bộ catalog thiết kế. BE-03 đã chặn underwear/swimwear/sleepwear tại POST /try-on bằng helper shared.

---

## Lịch sử

## 2026-10-13 · demo-casual-assets · ADDED
- Bởi: backend/shared
- Thay đổi: thêm 16 PNG/demo entries vào wardrobe manifest (tổng34), casual-specs.json và casual-outfits.json với4 sets itemIds. Giữ ID/field cũ, bounds alpha>16. Không đổi API/Zod/DB.
- Endpoint: không có.
- FE cần làm: thêm literal require/copy16 file tham chiếu manifest, Bộ phối sẵn chia Âu phục/Thường ngày; casual set thay picks/clear preset/giữ body, không đưa demo vào try-on hoặc resource wardrobe.
- Trạng thái FE: [x] (28 test mobile + tsc + export iOS/Android; chưa nghiệm thu thiết bị)


## 2026-10-12 · mannequin-assets · ADDED (nội bộ)
- Bởi: backend
- Thay đổi: thêm BodyKey, AssetStatus, GENERATION_MENUS, GenerationType, IdeaRequest/IdeaProposals/IdeaJobResponse, CreateAssetJobsRequest/Response, AssetJobResponse, MannequinAsset, AssetJobSummary và AssetQuotaResponse. Garment bổ sung source/mannequinAsset/assetJob; schema có defaults để parse dữ liệu cũ. CreateGarmentRequest thêm generateAsset/bodyKey/requestedType, các caller photo-model giữ schema riêng. API hiện nội bộ chưa release; mobile build cũ dùng strict schema phải cập nhật shared trước khi nhận field mới.
- Endpoint: POST/GET /garment-ideas(/:id); POST/GET /garment-asset-jobs(/:id); GET /asset-generation/quota. POST dùng Idempotency-Key.
- FE cần làm: theo packages/docs/handoffs/mannequin-frontend.md. Generate batch 1–4 món riêng, 5 image/ngày/user chung photo/idea; proposal LLM 10/ngày; reset Asia/Saigon. PNG alpha signed 15 phút; source AI concept khác ảnh người dùng. Món gốc giữ được dù job lỗi/hết lượt, auto generation chỉ khi generateAsset=true. Config mặc định chưa bật; enabled=false không giả lập thành công.
- Giới hạn biến thể (chốt 2026-10-12, chưa mở rộng DTO): mỗi Garment chỉ có một `mannequinAsset` hiện tại (một bodyKey). Tạo biến thể cho dáng còn lại sẽ thay asset hiện tại; file cũ vẫn giữ trong jobs và bị xóa cùng garment, nhưng không trả ra API. `assetJob.status=deferred` không tự chạy khi sang ngày mới, user phải bấm tạo hình. FE chỉ dùng PNG khi bodyKey khớp, khác body thì proxy 3D và cảnh báo trước khi tạo biến thể. Nếu cần giữ cả hai dáng, mở yêu cầu mới (ví dụ `mannequinAssets: {m?, f?}`).
- Assets: `formalwear/manifest.json` đã chuẩn hóa `bounds` [left,top,width,height] alpha>16 (bỏ `alphaBounds`), cùng định dạng với wardrobe và MannequinAsset; FE copy manifest mới và dùng trực tiếp.
- Trạng thái FE: [x] (code mobile tích hợp đủ endpoint qua schema shared, test logic + tsc + expo export; chưa chạy với API thật trên thiết bị, xem handoffs/mannequin-frontend-status.md)

## 2026-10-12 · try-on · ADDED
- Bởi: backend
- Thay đổi: CreateTryOnRequest `{modelPhotoId: UUID, garmentIds: UUID[] (1–4, không trùng), occasion: string (1–120)}`; IdempotencyKey (8–128 ký tự chữ/số/gạch nối/gạch dưới); CreateTryOnResponse `{jobId: UUID}`; TryOnStatus queued/processing/done/failed; TryOnJobResponse `{id,status,resultUrl: URL|null,errorCode: ErrorCode|null,outfitId: UUID|null,provider: openai|fake,createdAt}`. Thêm TRYON_CONTENT_REJECTED/TIMEOUT/PROVIDER_ERROR/INPUT_NOT_READY/GARMENT_NOT_ALLOWED và IDEMPOTENCY_CONFLICT.
- Endpoint: POST /try-on (Bearer Clerk, header Idempotency-Key bắt buộc); GET /try-on/:id (Bearer Clerk).
- FE cần làm: một thao tác giữ nguyên key khi gửi lại/mất mạng; tạo lại chủ động dùng key mới. Cùng key cùng payload trả job cũ (201), đổi payload trả 409. Chỉ chọn ảnh/món ready của user, chặn món không được try-on; backend vẫn kiểm tra lại. Poll GET đến done/failed; resultUrl và outfitId chỉ có khi done, URL signed 15 phút nên refresh GET khi hết hạn. provider=fake là ảnh mock cố định, phải hiển thị rõ; không phải ảnh thử đồ thật. Outfit tự tạo nhưng savedAt=null; API lưu lookbook thuộc BE-04.
- Worker: một job đồng thời; 3 attempts (lần đầu + tối đa 2 retry) cho lỗi có thể thử lại an toàn. Nội dung bị từ chối không retry. Timeout/network/5xx sau khi gọi AI có thể đã tính phí nên kết thúc failed, không tự gọi AI lại. Checkpoint file giúp retry ghi DB không tạo ảnh/outfit thứ hai. Job quá 15 phút chuyển failed khi sweep mỗi phút/khởi động hoặc khi GET.
- Phạm vi: UsageService reserve/refund là hooks trong transaction, chưa có quota thật; refund đánh dấu một lần. Chỉ dùng nội bộ trước BE-05. OpenAI adapter đã đối chiếu tài liệu; provider/prompt hiện là ứng viên, phase 0A và chất lượng trên ảnh thật chưa nghiệm thu.
- Trạng thái FE: [x]

## 2026-10-12 · wardrobe · ADDED
- Bởi: backend
- Thay đổi: thêm UploadAuthResponse, CreateModelPhotoRequest/CreateGarmentRequest, ModelPhoto/Garment, ModelPhotoListResponse/GarmentListResponse, DeleteMediaResponse, ResourceIdParams, MediaListQuery/GarmentListQuery. ProcessingStatus=pending/ready/failed; GarmentTags có category/type/slot, colors/material và pattern/fit/length/sleeve/neckline/rise/season/occasions/formality (1–5). Kiểm tra quan hệ type-category-slot; embeddings 1024 chiều. Garment.tryOnAllowed nullable khi pending, false cho underwear/swimwear/sleepwear.
- Endpoint: GET /uploads/auth; POST/GET /model-photos, GET/DELETE /model-photos/:id; POST/GET /garments, GET/DELETE /garments/:id. Tất cả yêu cầu Bearer token Clerk.
- FE cần làm: import schema/type từ shared; upload ImageKit trong folder được cấp với isPrivateFile=true; POST nhận thêm uploadToken=auth.token bắt buộc. Grant 10 phút, một ảnh một lần; không gửi userId. Response có id/imagekitFileId/url/thumbnailUrl/status/errorCode/createdAt, thêm analysis hoặc tags/tryOnAllowed. URL signed 15 phút, tải lại để làm mới. Poll GET theo id đến ready/failed. List {items,nextCursor}, limit 1–50 mặc định 20; garments thêm category. DELETE trả {deleted:true}. Resource/grant của người khác trả 404. Hiển thị errorCode lỗi ảnh hoặc MEDIA_PROCESSING_FAILED, không polling vô hạn.
- Xử lý lỗi: UPLOAD_INVALID/UPLOAD_EXPIRED; PHOTO_NOT_FULL_BODY/PHOTO_MULTIPLE_PEOPLE/PHOTO_NOT_ALLOWED/PHOTO_NOT_USABLE. Enqueue lỗi trả 503 nhưng resource failed vẫn có trong list. AI chỉ chạy worker, không nằm trong request.
- Phạm vi: thực hiện phân loại hai cấp theo yêu cầu 2026-10-10; danh sách type chi tiết cần đối chiếu thiết kế. Chưa có POST /try-on; chặn trang phục hạn chế thuộc BE-03. Chọn ảnh người mẫu mặc định lưu state mobile.
- Trạng thái FE: [x]

## 2026-10-10 · auth-native · CHANGED
- Bởi: backend
- Thay đổi: CLERK_AUTHORIZED_PARTIES mặc định rỗng và không còn fallback sang CORS_ORIGINS. Token session native không có azp không bị chặn bởi cấu hình CORS. Giữ kiểm tra chữ ký, thời hạn, user/session và trạng thái pending. Schema không đổi.
- Endpoint: các route yêu cầu Clerk session, gồm GET /me.
- FE cần làm: kiểm chứng đăng nhập và GET /me trên iOS/Android; không cần thay schema. Đây là yêu cầu backend ghi trong progress/frontend.md về lỗi đăng nhập xong tự đăng xuất. Danh sách không rỗng dành cho web và vẫn yêu cầu azp khớp.
- Trạng thái FE: [x]

## 2026-10-10 · auth · ADDED
- Bởi: backend
- Thay đổi: MeResponse `{ id: UUID, email: string | null, createdAt: ISO datetime }`; ClerkUserWebhook schema cho user.created/updated/deleted; WebhookAckResponse `{ received: true }`. Email có thể null khi tài khoản không có primary email. Không trả clerkUserId ra client.
- Endpoint: GET /me (Bearer session token), POST /webhooks/clerk (chữ ký Svix, raw body, HTTP 200 ack). GET /health vẫn public. Các route nghiệp vụ mặc định yêu cầu xác thực.
- FE cần làm: gọi /me với token Clerk, parse MeResponse; xử lý email null. x-request-id có trong response header. Webhook cần secret riêng ở backend; không gọi từ mobile.
- Trạng thái FE: [x]

## 2026-10-10 · local-dev · CHANGED
- Bởi: backend
- Thay đổi: API lắng nghe trên 0.0.0.0; `npm run dev` phát hiện IP LAN hiện tại, chờ API health trước khi mở Expo, truyền EXPO_PUBLIC_API_URL động. Không đổi schema hoặc lưu IP cố định.
- Endpoint: GET /health (schema giữ nguyên).
- FE cần làm: tầng API đọc `process.env.EXPO_PUBLIC_API_URL`; khi đổi Wi-Fi khởi động lại launcher. Hiện mobile chưa có caller fetch API. Có thể dùng `npm run dev:api` khi chỉ cần backend.
- Trạng thái FE: [x]

## 2026-10-10 · foundation · ADDED
- Bởi: backend
- Thay đổi: thêm `HealthResponse` với `{ status: "ok" }`; `ErrorCode` gồm UNAUTHORIZED, FORBIDDEN, NOT_FOUND, VALIDATION_ERROR, INTERNAL_ERROR; `ApiError` với `{ code, message, details? }`. Export từ `@stylist/shared`.
- Endpoint: GET /health; lỗi HTTP toàn API theo ApiError. Route mẫu GET / trả Hello World được thay bằng GET /health, chưa có consumer nghiệp vụ.
- FE cần làm: thêm dependency `@stylist/shared`, parse response /health bằng HealthResponse; dùng ApiError cho lỗi. Response 5xx không có lỗi nội bộ. Validation details chỉ có path/code, không có giá trị đầu vào.
- Trạng thái FE: [x]
