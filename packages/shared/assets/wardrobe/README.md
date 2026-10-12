# Bộ mẫu 34 món

Ảnh tạo bằng built-in Imagegen; prompts gốc nằm trong specs.json. Không dùng key OpenAI của backend để tạo bộ mẫu này.

manifest.json có 34 ID demo, tên ảnh, nhãn tiếng Việt, bodyKeys, kích thước và bounds `[left, top, width, height]` tính trên alpha > 16; lookTags/tags tương thích taxonomy. Các PNG giữ alpha và là asset 2D, không phải UV texture/mesh 3D hoặc resource Garment của backend.

Chỉ copy/bundle các file được manifest tham chiếu. navy-blazer-overlay.png là bản chỉnh khoảng mở ngực alpha để lộ sơ mi bên dưới; navy-blazer.png giữ làm bản gốc, không cần bundle.

Đã kiểm tra 34 ID khác nhau, file RGBA tồn tại, nền có alpha=0 và bounds nằm trong canvas; chưa coi là đã căn đúng trên điện thoại. Kính có phản xạ bán trong suốt; trang sức là hình tổng hợp, không phải ảnh sản phẩm thương mại thật.


## Thường ngày — 16 món mới (2026-10-13)

8 quần áo: thun đen oversized, polo navy, hoodie xám, sweater kem, denim, short kaki, cargo olive, jogger đen. 5 giày/dép: sneaker trắng, sneaker đen đế dày, sneaker thể thao phối màu, sandal nâu, slide đen. 3 nón: cap navy, cap kem, beanie xám.

Prompt và metadata nguồn nằm trong casual-specs.json. casual-outfits.json có bốn bộ phối tham chiếu itemIds: Basic, Đi học, Streetwear, Cuối tuần. Bộ phối dùng các món riêng, giữ body hiện tại và thay đồ đang chọn; không tạo ảnh toàn bộ mới. Type theo taxonomy hiện có: cargo/jogger=trousers, slide=other_shoes.

Jacket dùng blue-denim-jacket-overlay.png; bản blue-denim-jacket.png giữ làm nguồn, không bundle. Opening giữa hai tà áo alpha=0 để hiện áo bên dưới. Lưu ý preview một số công cụ có thể hiển thị RGB ở pixel alpha=0 thành quầng nền: kiểm tra alpha thật khi đánh giá transparency.

Kích thước PNG được đo thực tế, không giả định output luôn đúng kích thước yêu cầu. bodyKeys m/f là thiết kế unisex trong catalog; độ vừa/vị trí trên thiết bị vẫn xấp xỉ, không phải mesh/UV.
