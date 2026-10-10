# Giai đoạn 4 — Stylist cá nhân, lookbook và học gu

[← Thử đồ](phase-03-tryon.md) · [Roadmap](../ROADMAP.md) · [Tiếp: Hoàn thiện MVP →](phase-05-mvp-release.md)

## Kết quả sản phẩm

App giải thích cách phối và gợi ý bộ đồ từ tủ đồ riêng. Người dùng có bộ sưu tập outfit và hồ sơ gu; phản hồi ảnh hưởng đến gợi ý sau này.

**Điều kiện bắt đầu:** giai đoạn 3 hoàn thành; cơ chế lưu lookbook đã thống nhất trong contract.

**Prompt:** [BE-04](../prompts/backend/be-04-stylist-personalization.md) · [FE-04](../prompts/frontend/fe-04-lookbook-profile.md).

## Chức năng bổ sung

- Tư vấn: nhận xét, điểm mạnh, điều chỉnh kèm lý do, phụ kiện và độ phù hợp với dịp.
- Giọng tích cực, tập trung vào trang phục; không nhận xét tiêu cực về cơ thể.
- Lookbook: lưu/xem lại, lọc đã thích, thích/bỏ/xóa, chia sẻ ảnh qua hệ điều hành.
- Onboarding có thể bỏ qua; chỉnh gu, dịp, ngân sách, màu thích/tránh và thông tin AI phân tích.
- “Gợi ý cho tôi”: ba outfit có lý do; “Thử ngay” đưa lựa chọn vào Studio.
- Học gu bằng embedding outfit/feedback gần đây; user mới dùng hồ sơ style.

## Các bước triển khai

| Bước | Backend / shared | Mobile | Điểm kiểm chứng |
|---|---|---|---|
| 4.1 | Style profile GET/PUT và schema | Onboarding, chỉnh hồ sơ | Dữ liệu giữ sau mở lại app |
| 4.2 | Knowledge/prompt có version, StylistProvider, advice trong worker | Thẻ tư vấn/bottom sheet, Xin tư vấn | Advice lỗi vẫn giữ ảnh kết quả |
| 4.3 | GET/DELETE outfits, feedback true/false/null, cơ chế lưu | Lookbook, chi tiết, feedback, chia sẻ | Lưu/thích/bỏ/xóa đồng bộ |
| 4.4 | Taste vector, lọc dịp, xếp hạng và LLM chọn tổ hợp | Ba gợi ý, chuyển Studio | Chỉ dùng món hợp lệ của user |

## Điều kiện hoàn thành

- [ ] Advice đủ trường, validate Zod; sai định dạng thử lại một lần, thất bại không hỏng try-on.
- [ ] Xin tư vấn lại qua queue theo quy tắc AI của dự án; lưu version prompt/knowledge cùng advice.
- [ ] Hồ sơ/lookbook hoạt động với dữ liệu thật, phân trang và trạng thái rỗng.
- [ ] Feedback cập nhật vector đúng hướng; đổi feedback không cộng dồn sai cùng outfit.
- [ ] Suggest không trả món user khác/món đã xóa; ít đồ có thông báo phù hợp.
- [ ] Với bộ dữ liệu cố định và khoảng mười phản hồi, quan sát được thay đổi xếp hạng/gợi ý; ghi giới hạn, không coi số phản hồi là bảo đảm chất lượng.
- [ ] `npx turbo build test lint` xanh; contract và tiến độ được cập nhật.

**Demo cuối giai đoạn:** nhận ảnh + tư vấn → lưu/thích outfit → chỉnh hồ sơ → xin gợi ý theo dịp → Thử ngay.

## Giới hạn giai đoạn

Chưa làm mua sắm, thời tiết/lịch hoặc mạng xã hội. Chia sẻ ảnh qua hệ điều hành thuộc MVP; chia sẻ lookbook công khai thuộc sau MVP. Tiếp tục thử nội bộ với ngân sách giới hạn trước giai đoạn 5.
