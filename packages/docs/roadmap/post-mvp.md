# Sau MVP — Hướng mở rộng

[← Hoàn thiện MVP](phase-05-mvp-release.md) · [Roadmap](../ROADMAP.md)

## Kết quả mong muốn

Mở rộng từ stylist cá nhân sang sử dụng hằng ngày, thanh toán thuận tiện và chia sẻ. Đây là backlog định hướng, chưa phải các phase cam kết hoặc chức năng phải xây ngay.

**Điều kiện bắt đầu:** MVP đã được thử với người dùng thật; có dữ liệu chất lượng, độ trễ, chi phí và nhu cầu sử dụng lại.

## Các hướng phát triển

| Hướng | Người dùng có thêm gì? | Backend / shared | Mobile | Bằng chứng để ưu tiên |
|---|---|---|---|---|
| Mua gói trong app | Đăng ký/quản lý gói thuận tiện | RevenueCat PlanSource, webhook, entitlement | IAP, restore purchase, subscription | Có nhu cầu nâng cấp, điểm mua hiện tại gây khó khăn |
| Thời tiết/lịch | Chọn đồ theo bối cảnh ngày | Nguồn dữ liệu và ngữ cảnh | Quyền truy cập, chọn nguồn | Người dùng thường chọn đồ cho lịch hoạt động |
| Affiliate | Tìm món/phụ kiện còn thiếu | Danh mục/nguồn sản phẩm, tracking | Gợi ý mua sắm | Tư vấn tạo nhu cầu tìm sản phẩm |
| Chia sẻ lookbook | Chia sẻ bộ sưu tập | Quyền truy cập/thu hồi, contract chia sẻ | Chọn nội dung, xem trước, quản lý | Chia sẻ ảnh được dùng và có nhu cầu nhiều outfit |

## Cách biến một hướng thành phase mới

1. Chọn nhu cầu từ phản hồi và kết quả đo được.
2. Kiểm tra chi phí, quyền riêng tư và tích hợp hiện tại.
3. Tạo phase riêng với scope, contract, checklist hai bên và tiêu chí hoàn thành.
4. Chỉ đưa vào roadmap chính khi quyết định ưu tiên; không triển khai toàn bộ backlog cùng lúc.

## Điều kiện hoàn thành của một hướng mở rộng

- [ ] Có nhu cầu và tiêu chí thành công rõ.
- [ ] Có phase/prompt tương ứng; thay đổi phá tương thích ghi BREAKING.
- [ ] Luồng chạy trên dữ liệu thật và thiết bị mục tiêu.
- [ ] Chi phí/xử lý dữ liệu được kiểm chứng trước khi mở.

## Giới hạn

Chưa chốt thứ tự/lịch/provider/scope chi tiết. Xác nhận chính sách thanh toán và khả năng tích hợp tại thời điểm triển khai; không dùng backlog để mở rộng scope MVP.
