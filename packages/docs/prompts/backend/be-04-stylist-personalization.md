# Prompt BE-04 — Tư vấn stylist và cá nhân hóa

**Giao cho:** Codex. **Giai đoạn:** 4. **Cần xong trước:** BE-03.

---

Xây phần làm nên giá trị riêng của sản phẩm: tư vấn như một nhà thiết kế có kinh nghiệm, và gợi ý ngày càng đúng gu từng người.

## Việc cần làm

1. **Hồ sơ style**
   - Bảng `style_profiles`.
   - `GET /style-profile`, `PUT /style-profile`: styles, occasions, budget, màu ưa thích và màu tránh.
   - Tự điền `body_shape` và `skin_tone` từ phân tích ảnh người mẫu gần nhất, cho phép người dùng sửa.

2. **Bộ nguyên tắc phối đồ**
   - File `apps/api/src/stylist/knowledge/` chứa nguyên tắc dạng markdown: phối màu theo tông da, cân bằng tỉ lệ theo dáng người, độ trang trọng theo dịp, số lượng và cách chọn phụ kiện.
   - Chọn phần liên quan đưa vào prompt theo hồ sơ và dịp, không nhồi toàn bộ.

3. **`StylistProvider`**
   - Đầu vào: ảnh kết quả try-on, tag các món đồ, hồ sơ style, dịp, vài outfit đã thích gần đây.
   - Đầu ra có cấu trúc (`StylistAdvice`):
     - `summary`: nhận xét tổng thể, 1 đến 2 câu.
     - `strengths[]`: điểm đang làm tốt.
     - `adjustments[]`: điểm nên chỉnh, mỗi mục có lý do.
     - `accessories[]`: phụ kiện đề xuất (loại, mô tả, màu, lý do).
     - `occasionFit`: mức phù hợp với dịp.
   - Giọng văn: chuyên nghiệp, cụ thể, tích cực. Nhận xét về trang phục và cách phối, không nhận xét tiêu cực về cơ thể.
   - Validate đầu ra bằng Zod, thử lại một lần nếu sai định dạng.

4. **Tích hợp vào luồng try-on**
   - Sau khi có ảnh kết quả, worker gọi `StylistProvider` và lưu `advice` vào `outfits`.
   - Tư vấn lỗi không làm hỏng job: vẫn trả ảnh, `advice` để trống và cho phép tạo lại bằng `POST /outfits/:id/advice`.

5. **Lookbook và phản hồi**
   - `GET /outfits`: phân trang, lọc theo `liked`.
   - `POST /outfits/:id/feedback`: `liked` là true, false hoặc null.
   - `DELETE /outfits/:id`.

6. **Cá nhân hóa**
   - Embedding của outfit là trung bình embedding các món trong đó.
   - `taste_vector` cập nhật sau mỗi phản hồi: cộng dồn outfit đã thích, trừ nhẹ outfit đã bỏ, ưu tiên phản hồi gần đây.
   - `POST /stylist/suggest`: nhận `occasion`, trả 3 outfit ghép từ tủ đồ. Lọc theo độ trang trọng trước, xếp hạng bằng độ gần với `taste_vector` (pgvector), rồi để LLM chọn tổ hợp hợp lý và giải thích.
   - Người dùng mới chưa có phản hồi: dựa vào hồ sơ style.

7. **Contract**
   - `StyleProfile`, `UpdateStyleProfileRequest`, `StylistAdvice`, `Outfit`, `OutfitFeedbackRequest`, `SuggestRequest`, `SuggestResponse`.

## Ràng buộc

- Truy vấn vector có giới hạn số kết quả và lọc theo user.
- Prompt và nguyên tắc có phiên bản, lưu phiên bản đã dùng cùng với `advice` để so sánh chất lượng về sau.

## Kiểm thử

- Cập nhật `taste_vector`: thích và bỏ làm vector dịch chuyển đúng hướng.
- `suggest` không trả món đồ của user khác và không trả món đã xóa.
- Đầu ra LLM sai định dạng được xử lý êm.

## Hoàn thành khi

- Job try-on xong có kèm tư vấn đủ các trường.
- `POST /stylist/suggest` trả 3 outfit có lý do.
- `turbo build test lint` xanh.
- Đã ghi `CONTRACT_CHANGES.md` và `progress/backend.md`.
