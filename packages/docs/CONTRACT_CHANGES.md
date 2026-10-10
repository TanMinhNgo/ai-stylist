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

- [ ] 2026-10-10 · garments · Phân loại 2 cấp cho món đồ, áp dụng từ BE-02: `GarmentCategory` = top, outerwear, pants, skirt, dress, one_piece, traditional, shoes, bag, accessory (thay cho enum phẳng); thêm `GarmentType` (vd. shirt, blazer, wide_leg, ao_dai, crossbody, fedora…), `GarmentSlot` (top, outer, bottom, dress, shoes, bag, hat, eyewear, neck, belt, jewelry, watch) và các thuộc tính AI gắn tag: `pattern`, `fit`, `length`, `sleeve`, `neckline`, `rise`, `season`, `occasions[]`, `formality` 1–5. Underwear, swimwear, sleepwear vẫn lưu được nhưng bị chặn khi `POST /try-on`. Danh sách đầy đủ ở bảng "Phân loại trang phục" trong bản thiết kế UI · Lý do: bộ lọc Tủ đồ, màn Chi tiết món đồ, Studio (phối theo slot, dựng 3D) và gợi ý phối đều cần phân loại chi tiết

---

## Lịch sử

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
