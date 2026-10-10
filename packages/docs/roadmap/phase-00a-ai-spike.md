# Giai đoạn 0A — Kiểm chứng AI try-on

[← Giai đoạn 0](phase-00-monorepo.md) · [Roadmap](../ROADMAP.md) · [Tiếp: Nền tảng →](phase-01-foundation.md)

## Kết quả sản phẩm

Có ảnh mẫu và số liệu để quyết định try-on có đủ tốt, đủ nhanh và phù hợp ngân sách hay không. Đây là thử nghiệm độc lập, chưa tích hợp vào app.

**Điều kiện bắt đầu:** môi trường chạy script sẵn sàng; bộ ảnh có quyền sử dụng; ngân sách thử nghiệm được xác định.

**Prompt:** [01 — AI spike](../prompts/01-ai-spike.md).

## Chức năng và đầu ra bổ sung

- Script xử lý khoảng 20 ca, mỗi ca một ảnh người mẫu và 1–4 món đồ.
- Resize đầu vào, chạy tuần tự, giới hạn mặc định 5 ca mỗi lần.
- So sánh hai biến thể prompt trên cùng bộ ảnh.
- Báo cáo thời gian, usage, chi phí ước tính, lỗi và cột chấm tay.
- Quyết định ở `packages/docs/decisions/001-tryon-provider.md`.

## Checklist triển khai

- [ ] Backend đọc tài liệu chính thức để xác nhận model, endpoint và giá tại thời điểm thực hiện.
- [ ] Chuẩn bị inputs/outputs, loại ảnh khỏi phạm vi commit.
- [ ] Viết script và hai prompt: giữ mặt, tóc, dáng, tư thế, nền; bảo toàn màu, họa tiết và logo.
- [ ] Chạy bộ ảnh đa dạng, ghi báo cáo từng ca và từng prompt.
- [ ] Người dùng chấm ảnh dùng được hay không và ghi lỗi quan sát được.
- [ ] Tổng hợp số liệu, chốt provider/prompt; mobile dùng kết quả để thiết kế hướng dẫn chụp và màn chờ sau này.

## Điều kiện hoàn thành

- [ ] Script tạo ảnh và báo cáo từ provider thật.
- [ ] Có thống kê thời gian, chi phí, lỗi và tỷ lệ dùng được từ chấm tay.
- [ ] File quyết định ghi bộ thử, model, prompt, cấu hình và giới hạn đã quan sát.
- [ ] Người dùng chốt giữ OpenAI hay thử provider khác; phần quyết định không để trống trước giai đoạn 3.

**Demo cuối giai đoạn:** xem một ca đầu vào, hai ảnh kết quả và số liệu trong báo cáo.

Nếu tỷ lệ dùng được dưới khoảng 70% hoặc chi phí quá cao so với giá gói dự kiến, điều chỉnh hoặc đổi provider trước khi tích hợp. Ngưỡng chi phí cần chốt theo ngân sách; hạn mức 5/50/200 hiện là dự kiến.

## Giới hạn giai đoạn

Chưa xây queue/API try-on hoặc Studio. Chi phí try-on chưa bao gồm toàn bộ vision, embeddings, tư vấn, retry và lưu trữ; tính thêm các khoản này khi chốt gói.
