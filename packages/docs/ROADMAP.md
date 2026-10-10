# Roadmap AI Stylist

Lộ trình đi từ khung kỹ thuật đến app stylist cá nhân có thể cho người dùng thử. Mỗi giai đoạn có một file riêng mô tả kết quả sản phẩm, chức năng bổ sung, phân công và cách kiểm chứng.

## Các giai đoạn

| Giai đoạn | Hệ thống trở thành gì? | Chức năng mới | Chi tiết |
|---|---|---|---|
| 0 | Khung app và API giao tiếp được | Workspace, shared contract, health check, môi trường dev | [Dựng monorepo](roadmap/phase-00-monorepo.md) |
| 0A | Có bằng chứng để chọn công nghệ try-on | Bộ thử ảnh, so sánh prompt, báo cáo chất lượng và chi phí | [Thử nghiệm AI](roadmap/phase-00a-ai-spike.md) |
| 1 | App có tài khoản riêng | Đăng ký, đăng nhập, đồng bộ user, bốn tab | [Nền tảng và tài khoản](roadmap/phase-01-foundation.md) |
| 2 | Người dùng có tủ đồ số | Upload, phân tích ảnh, gắn tag, lọc và quản lý đồ | [Ảnh và tủ đồ](roadmap/phase-02-wardrobe.md) |
| 3 | Thử quần áo lên ảnh người dùng | Studio, job AI nền, màn chờ, kết quả, so sánh trước/sau | [Thử đồ](roadmap/phase-03-tryon.md) |
| 4 | App tư vấn và học gu | Tư vấn, lookbook, hồ sơ style, feedback, gợi ý outfit | [Stylist và cá nhân hóa](roadmap/phase-04-stylist.md) |
| 5 | MVP kiểm soát chi phí, sẵn sàng thử nghiệm | Hạn mức, gói, hoàn lượt, xóa tài khoản, EAS preview | [Hoàn thiện MVP](roadmap/phase-05-mvp-release.md) |
| Sau MVP | Mở rộng theo nhu cầu thực tế | IAP, thời tiết/lịch, affiliate, chia sẻ lookbook | [Hướng mở rộng](roadmap/post-mvp.md) |

## Thứ tự phát triển

`0 → 0A → 1 → 2 → 3 → 4 → 5`

- Làm 0A ngay sau 0 để phát hiện sớm rủi ro chất lượng và chi phí. Phải chốt provider trước giai đoạn 3.
- Backend xác định contract trước; mobile phát triển theo từng luồng đã có contract.
- Giai đoạn 3–4 thử nội bộ với ngân sách giới hạn. Hoàn thành bảo vệ chi phí ở 5 trước khi mở cho người dùng thật.
- Ước tính cũ: 0 khoảng 1–2 ngày, 0A khoảng 2–3 ngày; 1–2 khoảng hai tuần, 3–4 khoảng bốn tuần, 5 khoảng hai tuần. Điều chỉnh theo thực tế; thời gian không thay thế tiêu chí hoàn thành.

## Cách làm việc

1. Đọc kết quả và điều kiện bắt đầu trong file phase.
2. Chọn một bước, triển khai contract/backend/mobile cần thiết cho luồng đó theo quyền sở hữu.
3. Dùng prompt được liên kết để giao việc: roadmap định nghĩa mục tiêu/phạm vi, prompt mô tả triển khai, [architecture.md](architecture.md) mô tả kiến trúc.
4. Kiểm chứng demo và checklist; ghi rõ mock hoặc kiểm tra còn thiếu.
5. Cập nhật [tiến độ backend](progress/backend.md), [tiến độ frontend](progress/frontend.md) theo quyền sở hữu và [contract changes](CONTRACT_CHANGES.md) nếu đổi contract.

Checklist chưa tick là kế hoạch, không khẳng định code chưa tồn tại. Tiến độ thực tế ghi trong `progress/`; không tick chỉ vì đã có tài liệu hoặc mock.

## Quy tắc chung

- Codex sở hữu `apps/api` và `packages/shared`; Claude sở hữu `apps/mobile`.
- API dùng Zod schema từ `@stylist/shared`; thay đổi contract phải ghi nhật ký.
- Dữ liệu gắn với user từ token; AI chạy qua queue; ảnh người mẫu private và hỗ trợ xóa.
- Mỗi giai đoạn triển khai chạy `npx turbo build test lint` và kiểm tra thủ công tương ứng. Test mock không thay kiểm chứng provider/thiết bị thật.
- Chốt quyết định còn mở và cập nhật architecture/prompt/contract liên quan trước phần triển khai phụ thuộc.
