# Formalwear assets

4 ảnh PNG RGBA 1024×1536 được tạo bằng built-in Imagegen cho AI Stylist: `navy-business.png`, `charcoal-pinstripe.png`, `black-tuxedo.png`, `ivory-womens-suit.png`.

`manifest.json` ghi nhãn, bodyKey, kích thước, bounds `[left, top, width, height]` của pixel alpha > 16, màu và lookTags tương thích bộ ánh xạ mannequin hiện có. Tất cả là preset demo, không phải Garment API hoặc ảnh try-on người dùng.

Bàn giao và prompt: [formalwear-assets.md](../../../docs/handoffs/formalwear-assets.md).

Đã kiểm tra ảnh, PNG RGBA, alpha tại bốn góc = 0, 4 ID khác nhau, path tồn tại và 4 slot top/outer/bottom/shoes. Giữ alpha khi tích hợp; dùng require tĩnh trên Expo. PNG chính diện dùng cho preview/overlay đã căn, không phải UV atlas hoặc mesh 3D xoay được. Việc tích hợp và kiểm chứng điện thoại giao frontend.
