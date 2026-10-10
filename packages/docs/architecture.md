# Kiến trúc

## 1. Thành phần

```
Mobile (Expo) ──HTTP──> API (NestJS) ──> Neon (Postgres + pgvector)
     │                      │
     │ upload trực tiếp     ├──> Redis ──> Worker (BullMQ)
     ▼                      │                 │
  ImageKit <────────────────┘                 ├──> OpenAI (image edit, vision, embeddings)
                                              └──> ImageKit (lưu ảnh kết quả)
Clerk: đăng nhập trên mobile, verify token và webhook ở API
```

## 2. Cấu trúc repo

```
apps/
  api/        NestJS
  mobile/     Expo
packages/
  shared/     Zod schema, type, enum, mã lỗi
  docs/       tài liệu, contract changes, prompt
scripts/
```

## 3. Database

| Bảng | Cột chính |
|---|---|
| `users` | id, clerk_user_id (unique), email, created_at |
| `style_profiles` | user_id, body_shape, skin_tone, styles[], occasions[], budget, taste_vector |
| `model_photos` | id, user_id, imagekit_file_id, url, analysis (jsonb) |
| `garments` | id, user_id, imagekit_file_id, url, category, colors[], material, formality, embedding |
| `tryon_jobs` | id, user_id, model_photo_id, garment_ids[], occasion, status, result_url, error_code |
| `outfits` | id, user_id, tryon_job_id, advice (jsonb), liked, saved_at |
| `usage_ledger` | id, user_id, type, job_id, delta, created_at |

Ghi chú:
- `tryon_jobs.status`: `queued`, `processing`, `done`, `failed`.
- `usage_ledger.delta`: `-1` khi tạo job, `+1` khi hoàn lượt. Số lượt đã dùng trong tháng là tổng `delta` của tháng đó.
- Cột vector có số chiều khớp model embedding đang dùng.
- Kết nối: bản pooled cho API và worker, bản direct cho migration.

## 4. API

| Method | Đường dẫn | Mô tả |
|---|---|---|
| GET | `/health` | Kiểm tra sống |
| GET | `/me` | Thông tin user hiện tại |
| POST | `/webhooks/clerk` | Đồng bộ user |
| GET | `/uploads/auth` | Chữ ký upload ImageKit |
| POST | `/model-photos` | Lưu và phân tích ảnh người mẫu |
| GET | `/model-photos` | Danh sách ảnh người mẫu |
| DELETE | `/model-photos/:id` | Xóa ảnh |
| POST | `/garments` | Thêm món đồ, AI gắn tag |
| GET | `/garments` | Danh sách, lọc theo loại, phân trang |
| DELETE | `/garments/:id` | Xóa món đồ |
| POST | `/try-on` | Tạo job thử đồ |
| GET | `/try-on/:id` | Trạng thái và kết quả |
| POST | `/stylist/suggest` | Gợi ý outfit theo dịp |
| GET | `/outfits` | Lookbook |
| POST | `/outfits/:id/feedback` | Thích hoặc bỏ |
| GET | `/style-profile` | Hồ sơ style |
| PUT | `/style-profile` | Cập nhật hồ sơ |
| GET | `/usage` | Gói hiện tại và số lượt còn lại |

Tất cả trừ `/health` và `/webhooks/*` yêu cầu token Clerk.

## 5. Luồng thử đồ

1. App gọi `POST /try-on` với `modelPhotoId`, `garmentIds`, `occasion`.
2. API kiểm tra quyền sở hữu, kiểm tra hạn mức, ghi `usage_ledger` (-1), tạo job `queued`, trả `jobId`.
3. Worker đổi trạng thái `processing`, lấy URL ảnh đã resize từ ImageKit, gọi `TryOnProvider`.
4. Worker lưu ảnh kết quả lên ImageKit, gọi LLM tạo tư vấn, tạo bản ghi `outfits`, đổi trạng thái `done`.
5. Nếu lỗi sau khi hết lượt retry: trạng thái `failed`, ghi `error_code`, hoàn lượt (+1).
6. App polling `GET /try-on/:id` cho đến khi `done` hoặc `failed`.

## 6. Tầng AI

| Việc | Cách làm | Đầu ra |
|---|---|---|
| Thử đồ | OpenAI image edit, ảnh người mẫu và ảnh món đồ làm tham chiếu | Ảnh |
| Phân tích ảnh người mẫu | Vision, structured output | `body_shape`, `skin_tone`, ghi chú tỉ lệ |
| Gắn tag món đồ | Vision, structured output | category, colors, material, formality |
| Tư vấn | LLM với ảnh kết quả, hồ sơ style, nguyên tắc phối đồ | JSON: nhận xét, điểm chỉnh, phụ kiện, lý do |
| Cá nhân hóa | Embedding món đồ, trung bình có trọng số các outfit đã thích | `taste_vector` |

Nguyên tắc:
- Mọi lời gọi AI đi qua interface (`TryOnProvider`, `VisionProvider`, `StylistProvider`) để đổi nhà cung cấp không ảnh hưởng phần còn lại.
- Tên model đọc từ biến môi trường.
- Prompt đặt trong file riêng, có phiên bản, không nối chuỗi rải rác trong code.
- Đầu ra của LLM luôn được validate bằng Zod trước khi lưu.

## 7. Gói và hạn mức

| Gói | Lượt try-on mỗi tháng | Ghi chú |
|---|---|---|
| Free | 5 | Tư vấn cơ bản |
| Plus | 50 | Tư vấn đầy đủ, gợi ý phụ kiện |
| Pro | 200 | Ưu tiên hàng chờ |

Con số là tạm tính, chốt lại sau giai đoạn 0A khi biết chi phí thực mỗi lượt.

`getUserPlan(userId)` là nơi duy nhất quyết định gói của user. Hiện đọc từ Clerk, sau này có thể đổi sang RevenueCat mà không sửa nơi gọi.

## 8. Biến môi trường

**`apps/api/.env`**
```
DATABASE_URL=            # Neon pooled
DIRECT_URL=              # Neon direct, dùng cho migration
REDIS_URL=
CLERK_SECRET_KEY=
CLERK_WEBHOOK_SECRET=
IMAGEKIT_PUBLIC_KEY=
IMAGEKIT_PRIVATE_KEY=
IMAGEKIT_URL_ENDPOINT=
OPENAI_API_KEY=
OPENAI_IMAGE_MODEL=
OPENAI_VISION_MODEL=
OPENAI_EMBEDDING_MODEL=
```

**`apps/mobile/.env`**
```
EXPO_PUBLIC_API_URL=
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=
EXPO_PUBLIC_IMAGEKIT_PUBLIC_KEY=
EXPO_PUBLIC_IMAGEKIT_URL_ENDPOINT=
```

## 9. Rủi ro và cách xử lý

| Rủi ro | Cách xử lý |
|---|---|
| Chi phí AI vượt kiểm soát | Hạn mức theo gói, resize ảnh trước khi gửi, tối đa 4 món mỗi lượt |
| Ảnh try-on lệch mặt hoặc sai họa tiết | Hướng dẫn chụp chuẩn, nút tạo lại, interface cho phép đổi nhà cung cấp |
| Ảnh bị bộ lọc nội dung từ chối | Mã lỗi riêng, thông báo rõ, hoàn lượt |
| Lộ ảnh cơ thể người dùng | Ảnh private, signed URL có hạn, xóa hẳn khi yêu cầu, không log URL |
| Ảnh trẻ em hoặc ảnh người khác | Điều khoản sử dụng, kiểm tra ở bước phân tích ảnh, từ chối khi phát hiện |
| Hai agent làm lệch contract | `packages/shared` là nguồn duy nhất, `CONTRACT_CHANGES.md`, kiểm tra ở CI |
