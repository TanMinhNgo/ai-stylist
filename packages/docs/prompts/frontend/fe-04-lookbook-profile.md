# Prompt FE-04 — Tư vấn, lookbook, hồ sơ style

**Giao cho:** Claude Code. **Giai đoạn:** 4. **Cần backend:** BE-04.

---

Phần này thể hiện vai trò "nhà thiết kế cá nhân". Trình bày tư vấn sao cho giống lời khuyên từ một stylist, không giống một báo cáo máy móc.

## Việc cần làm

1. **Thẻ tư vấn trên màn kết quả**
   - Hiển thị `StylistAdvice`: nhận xét tổng thể nổi bật ở trên, tiếp theo là điểm mạnh, điểm nên chỉnh kèm lý do, phụ kiện đề xuất, mức phù hợp với dịp.
   - Phụ kiện hiển thị dạng thẻ ngang: loại, mô tả, chấm màu, lý do.
   - Dạng bottom sheet kéo lên để không che ảnh.
   - Khi `advice` trống: nút "Xin tư vấn" gọi `POST /outfits/:id/advice`.

2. **Lookbook**
   - Lưới outfit đã lưu, lọc: tất cả, đã thích.
   - Cuộn vô hạn.
   - Màn chi tiết: ảnh, tư vấn, các món đã dùng (bấm vào mở món trong tủ đồ), dịp, ngày tạo.
   - Thích hoặc bỏ bằng `POST /outfits/:id/feedback`, cập nhật lạc quan.
   - Xóa có xác nhận. Chia sẻ ảnh qua bảng chia sẻ của hệ điều hành.

3. **Hồ sơ style**
   - Onboarding lần đầu, 4 đến 5 bước ngắn, bỏ qua được: gu (chọn bằng hình ảnh), dịp hay mặc, màu ưa thích và màu tránh, ngân sách.
   - Màn chỉnh sửa trong tab Hồ sơ. Hiển thị dáng người và tông da do AI phân tích, cho phép sửa.
   - Lưu bằng `PUT /style-profile`.

4. **Gợi ý outfit**
   - Ở Studio thêm lối vào "Gợi ý cho tôi": chọn dịp, gọi `POST /stylist/suggest`.
   - Hiển thị 3 phương án, mỗi phương án có ảnh các món và lý do.
   - Nút "Thử ngay" đưa các món đó vào Studio với lựa chọn đã điền sẵn.
   - Tủ đồ quá ít món: giải thích và dẫn tới thêm đồ.

## Ràng buộc

- Văn phong hiển thị tích cực. Nếu nội dung tư vấn chứa nhận xét tiêu cực về cơ thể, ghi vào "Yêu cầu đang chờ" để backend chỉnh prompt, không tự lọc ở app.
- Onboarding không chặn người dùng vào app.

## Hoàn thành khi

- Kết quả try-on hiển thị tư vấn đầy đủ.
- Lưu, thích, bỏ, xóa outfit hoạt động và đồng bộ đúng.
- Gợi ý outfit dẫn được sang thử đồ.
- `turbo build test lint` xanh.
- Đã cập nhật `progress/frontend.md` và `CONTRACT_CHANGES.md`.
