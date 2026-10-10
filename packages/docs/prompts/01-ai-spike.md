# Prompt 01 — Thử nghiệm AI try-on

**Giao cho:** agent backend. Làm trước giai đoạn 3, tốt nhất là ngay sau giai đoạn 0.

---

Viết script độc lập để đánh giá chất lượng và chi phí của try-on bằng OpenAI image edit. Chưa tích hợp vào API.

## Yêu cầu

1. Tạo `apps/api/scripts/tryon-spike/` gồm:
   - `inputs/`: nơi tôi đặt ảnh thử. Mỗi ca thử là một thư mục con có `model.jpg` và 1 đến 4 ảnh món đồ.
   - `run.ts`: duyệt từng ca, resize ảnh về cạnh dài tối đa 1024px, gọi OpenAI image edit với ảnh người mẫu và các ảnh món đồ làm tham chiếu.
   - `outputs/`: ảnh kết quả, đặt tên theo ca thử.
   - `report.md`: bảng tổng hợp sinh tự động.

2. Tên model đọc từ `OPENAI_IMAGE_MODEL`. Trước khi viết code, đọc tài liệu chính thức của OpenAI để xác nhận tên model, tham số của endpoint image edit và cách tính giá hiện tại.

3. Prompt try-on đặt trong `prompt.md`, yêu cầu rõ:
   - Giữ nguyên khuôn mặt, tóc, dáng người, tư thế và nền.
   - Chỉ thay trang phục bằng đúng các món trong ảnh tham chiếu, giữ màu, họa tiết và logo.
   - Ánh sáng và nếp vải tự nhiên theo tư thế.

4. Với mỗi ca, ghi lại: thời gian xử lý, số token đầu vào và đầu ra, chi phí ước tính, có bị từ chối hay lỗi không.

5. `report.md` gồm: bảng từng ca, thời gian trung bình, chi phí trung bình mỗi lượt, tỷ lệ lỗi. Để trống cột "Dùng được (có/không)" và "Ghi chú" cho tôi chấm tay.

6. Chạy thử 2 biến thể prompt trên cùng bộ ảnh để so sánh.

## Ràng buộc

- Chạy tuần tự, có giới hạn số ca mỗi lần chạy (mặc định 5) để tránh tốn tiền ngoài ý muốn.
- Không commit ảnh trong `inputs/` và `outputs/`.

## Hoàn thành khi

- Chạy được với bộ ảnh mẫu và sinh ra `report.md`.
- Tạo `packages/docs/decisions/001-tryon-provider.md` theo mẫu: bối cảnh, số liệu, các lựa chọn, quyết định (để trống phần quyết định cho tôi điền sau khi chấm).
