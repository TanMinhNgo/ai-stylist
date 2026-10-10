# Giai đoạn 3 — Studio và thử đồ AI

[← Tủ đồ](phase-02-wardrobe.md) · [Roadmap](../ROADMAP.md) · [Tiếp: Stylist →](phase-04-stylist.md)

## Kết quả sản phẩm

Người dùng chọn trang phục từ tủ đồ và xem ảnh mình mặc chúng. Đây là bản thử nội bộ của tính năng lõi; chưa mở cho người dùng thật khi chưa có bảo vệ chi phí ở giai đoạn 5.

**Điều kiện bắt đầu:** giai đoạn 2 hoàn thành; quyết định provider/prompt từ 0A đã chốt.

**Prompt:** [BE-03](../prompts/backend/be-03-tryon.md) · [FE-03](../prompts/frontend/fe-03-studio-tryon.md).

## Chức năng bổ sung

- Studio chọn ảnh người mẫu, 1–4 món ready và dịp; giữ lựa chọn dở khi đổi tab.
- Tạo job thử đồ, chống gửi trùng bằng `Idempotency-Key`.
- Màn chờ queued/processing, có thể rời đi và quay lại.
- Ảnh kết quả, zoom, so sánh trước/sau, tạo lại và thử bộ khác.
- Lỗi nội dung, timeout và provider có thông báo riêng.

## Các bước triển khai

| Bước | Backend / shared | Mobile | Điểm kiểm chứng |
|---|---|---|---|
| 3.1 | Contract job, kiểm tra sở hữu/ready, POST/GET try-on | Studio và selection state | Chặn món chưa ready/quá bốn món |
| 3.2 | Worker, TryOnProvider và FakeTryOnProvider | Polling theo trạng thái | Fake provider chạy trọn luồng |
| 3.3 | Resize, lưu ảnh kết quả, tạo outfit chưa có advice | Kết quả, so sánh, zoom, tạo lại | Ảnh thật xem được trên thiết bị |
| 3.4 | Retry/backoff, idempotency, job treo, usage hooks | Chống bấm đúp, mất mạng, rời/quay lại app | Không tạo job/outfit trùng |

## Điều kiện hoàn thành

- [ ] Job đi đúng queued → processing → done/failed; lỗi tạm thời retry tối đa hai lần, lỗi nội dung không retry.
- [ ] Hai request cùng key của cùng user chỉ tạo một job; key không cho truy cập job user khác.
- [ ] Worker chạy lại không tạo ảnh/outfit trùng; job treo được xử lý.
- [ ] Có `UsageService.reserve/refund` để tích hợp ở 5; chưa coi hooks này là bảo vệ chi phí thật.
- [ ] Luồng chạy với fake provider và provider thật trên thiết bị, gồm mất mạng/rời app/quay lại.
- [ ] `npx turbo build test lint` xanh; contract và tiến độ được cập nhật.

**Demo cuối giai đoạn:** chọn ảnh + hai món + dịp → tạo job → rời màn chờ → quay lại → xem ảnh và so sánh.

## Quyết định cần chốt trước phần phụ thuộc

- Worker tạo outfit tự động nhưng UI có nút lưu lookbook: xác định cơ chế lưu và contract, hoàn thiện ở 4.
- Tái sử dụng cùng idempotency key cho các lần gửi lại của một thao tác; tạo lại chủ động dùng key mới.
- Mobile ngừng polling ở nền nên không bảo đảm phát hiện job xong bằng polling. Chốt cơ chế thông báo trước yêu cầu thông báo nền của FE-03, kiểm chứng trên thiết bị thật.

## Giới hạn giai đoạn

Chưa có advice/cá nhân hóa hoặc hạn mức thật. Provider thật chỉ dùng thử có giới hạn; ảnh có thể sai mặt, màu hoặc họa tiết dù job thành công.
