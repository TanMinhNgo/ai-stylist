# Giai đoạn 5 — Hạn mức, quyền riêng tư và hoàn thiện MVP

[← Stylist](phase-04-stylist.md) · [Roadmap](../ROADMAP.md) · [Tiếp: Sau MVP →](post-mvp.md)

## Kết quả sản phẩm

Có MVP cài được lên thiết bị thật, kiểm soát chi phí và đủ luồng tài khoản/quyền riêng tư để mở thử có kiểm soát. Chưa đồng nghĩa đã phát hành trên App Store/Google Play.

**Điều kiện bắt đầu:** giai đoạn 4 hoàn thành; có số liệu chi phí để chốt hạn mức; cách đọc plan Clerk và điểm mua gói web được xác nhận.

**Prompt:** [BE-05](../prompts/backend/be-05-usage-billing.md) · [FE-05](../prompts/frontend/fe-05-usage-polish.md).

## Chức năng bổ sung

- Free/Plus/Pro và lượt theo tháng UTC; 5/50/200 là dự kiến đến khi chốt chi phí.
- Trừ khi tạo job, hoàn đúng một lần khi thất bại; số lượt còn lại và ngày reset.
- Cache plan, cập nhật khi gói đổi, ưu tiên queue Pro.
- Rate limit, giới hạn job mỗi user và theo dõi chi phí AI.
- Xóa tài khoản/toàn bộ dữ liệu và ảnh; điều khoản và chính sách quyền riêng tư.
- Hoàn thiện mất mạng, loading/rỗng/lỗi, trợ năng và EAS preview.

## Các bước triển khai

| Bước | Backend / shared | Mobile | Điểm kiểm chứng |
|---|---|---|---|
| 5.1 | PlanSource/getUserPlan, cache, verify webhook | Gói từ /usage, refresh khi quay lại | Quyền thật do backend quyết định |
| 5.2 | Ledger, reserve/refund atomic/idempotent | Lượt, hết lượt, reset, refresh sau job | Request đồng thời không vượt quota |
| 5.3 | Rate limit, concurrency, ưu tiên Pro, thống kê | Thông báo giới hạn, tránh retry liên tục | Bảo vệ endpoint tốn kém |
| 5.4 | DELETE /me qua queue, an toàn khi chạy lại | Xác nhận hai bước, đăng xuất, chính sách | Dữ liệu/ảnh được xóa hết |
| 5.5 | Rà log/lỗi vận hành | Màn nhỏ, trợ năng, iOS/Android, EAS | Preview chạy trọn luồng |

## Điều kiện hoàn thành

- [ ] Còn một lượt, hai request đồng thời chỉ một thành công.
- [ ] Job lỗi hoàn đúng một lượt dù retry/restart/gọi refund hai lần.
- [ ] Ledger trừ -1, hoàn +1: đã dùng tính bằng âm tổng delta phù hợp; refund qua tháng không tạo lượt miễn phí sai chu kỳ.
- [ ] Hết lượt trả QUOTA_EXCEEDED/thời điểm reset; chuyển tháng UTC đúng.
- [ ] Gói thật từ Clerk được kiểm chứng; client không tự mở quyền.
- [ ] Xóa tài khoản ngăn job đang chạy tạo lại dữ liệu; kiểm chứng worker và ảnh ImageKit.
- [ ] Log không chứa URL ảnh/email/token; có thống kê chi phí user/job.
- [ ] Không có giá/nút mua/link thanh toán trong app; kiểm tra preview trên iOS/Android, mạng yếu và cỡ chữ lớn.
- [ ] `npx turbo build test lint` xanh; contract, tiến độ và hướng dẫn build được cập nhật.

**Demo cuối giai đoạn:** hết lượt Free → bị chặn → job lỗi được hoàn → kiểm tra reset bằng test → xóa tài khoản và kiểm chứng dữ liệu biến mất.

## Quyết định cần chốt trước thử nghiệm người dùng

- Chu kỳ hoàn lượt khi job thất bại sau khi sang tháng mới.
- Nơi mua/quản lý gói web: hiện chưa có phase triển khai web. Nếu chưa có web billing, xác định phạm vi thử Free và cách test các plan trước khi công bố gói trả phí.
- Quyền tư vấn cơ bản/đầy đủ/phụ kiện theo gói; đồng bộ architecture/contract nếu áp dụng.

## Giới hạn giai đoạn

Chưa có RevenueCat/IAP hoặc quy trình phát hành store đầy đủ. Build/test xanh không xác nhận chính sách store/provider; chỉ công bố luồng đã kiểm chứng.
