# Giai đoạn 2 — Ảnh người mẫu và tủ đồ số

[← Nền tảng](phase-01-foundation.md) · [Roadmap](../ROADMAP.md) · [Tiếp: Thử đồ →](phase-03-tryon.md)

## Kết quả sản phẩm

Người dùng có ảnh người mẫu phù hợp và tủ đồ đã được AI gắn tag. App quản lý được trang phục và cung cấp dữ liệu cho try-on.

**Điều kiện bắt đầu:** giai đoạn 1 hoàn thành; ImageKit và provider vision/embedding đã cấu hình.

**Prompt:** [BE-02](../prompts/backend/be-02-uploads-wardrobe.md) · [FE-02](../prompts/frontend/fe-02-wardrobe.md).

## Chức năng bổ sung

- Chọn/chụp ảnh, nén/resize, upload trực tiếp với tiến trình, hủy và thử lại.
- Hướng dẫn chụp toàn thân; phân tích dáng, tông da và độ phù hợp của ảnh.
- Thêm nhiều món, AI gắn category/colors/material/formality và tạo embedding.
- Tủ đồ dạng lưới, lọc loại, phân trang cursor, chi tiết và xóa.
- Trạng thái pending/ready/failed để theo dõi xử lý.

## Các bước triển khai

| Bước | Backend / shared | Mobile | Điểm kiểm chứng |
|---|---|---|---|
| 2.1 | ImageStorageProvider, uploads/auth, private/signed URL | Upload, quyền ảnh/camera, resize/progress | Upload thật, thumbnail đã resize |
| 2.2 | CRUD model photos, queue analysis, lỗi ảnh riêng | Hướng dẫn chụp, danh sách, trạng thái | Ảnh không phù hợp có lỗi và hướng dẫn |
| 2.3 | CRUD garments, tag/embedding, schema/enum | Lưới, lọc, thêm nhiều ảnh, chi tiết | Tag thật hiển thị khi ready |
| 2.4 | Quyền sở hữu, giới hạn trang, xóa file/dữ liệu | Xác nhận xóa, optimistic update/rollback | User khác không truy cập được |

## Điều kiện hoàn thành

- [ ] Thêm một ảnh người mẫu và ít nhất ba món từ app, thấy phân tích/tag thật.
- [ ] Phân trang/lọc với vài chục món, lưới không tải ảnh gốc.
- [ ] AI sai schema chuyển xử lý sang failed, không làm sập worker.
- [ ] User A không đọc/xóa dữ liệu user B; ảnh private không truy cập được bằng URL không hợp lệ.
- [ ] Xóa ảnh người mẫu xóa cả file ImageKit; kiểm chứng xóa món theo contract.
- [ ] `npx turbo build test lint` xanh; contract và tiến độ được cập nhật.

**Demo cuối giai đoạn:** thêm ảnh người mẫu → thêm ba món → chờ tag → lọc → chi tiết → xóa một món.

## Quyết định cần chốt trước phần phụ thuộc

- Ảnh người mẫu mặc định lưu ở backend hay state app; nếu backend lưu thì bổ sung contract.
- Contract trạng thái và cách theo dõi phân tích ảnh người mẫu để màn chờ có điểm kết thúc.
- Xác minh file upload thuộc user hiện tại, không chỉ kiểm tra fileId tồn tại; cách xử lý file chưa đăng ký hoặc bị phân tích từ chối.

## Giới hạn giai đoạn

Chưa tạo ảnh thử đồ/tư vấn. Vision có thể sai; UI phải thông báo rõ và cho người dùng xử lý lại.
