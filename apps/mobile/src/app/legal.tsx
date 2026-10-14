import { useLocalSearchParams } from 'expo-router';
import { Screen, Text } from '@/components/ui';

export default function LegalScreen() {
  const { kind } = useLocalSearchParams<{ kind?: string }>();
  const privacy = kind === 'privacy';
  return <Screen title={privacy ? 'Quyền riêng tư' : 'Điều khoản sử dụng'}>
    <Text variant="title">Bản dự thảo — chưa được phê duyệt pháp lý</Text>
    <Text variant="body">AI Stylist đang trong giai đoạn thử nghiệm. Nội dung dưới đây mô tả cách ứng dụng hiện hoạt động; cần bổ sung đơn vị chịu trách nhiệm, đầu mối liên hệ và chính sách lưu trữ đầy đủ trước khi phát hành công khai.</Text>
    {privacy ? <>
      <Text variant="headline">Dữ liệu và nhà cung cấp</Text><Text variant="body">Clerk xử lý đăng nhập và tài khoản. Ứng dụng lưu ảnh người mẫu, quần áo, ảnh thử đồ, lựa chọn phong cách và đánh giá outfit; ImageKit lưu ảnh private. Backend gửi nội dung cần thiết tới OpenAI để phân tích ảnh, tạo hình và tư vấn. Không đưa API key vào ứng dụng.</Text>
      <Text variant="headline">Quyền và truy cập ảnh</Text><Text variant="body">Chỉ yêu cầu quyền camera khi bạn chụp và quyền ảnh theo tính năng chọn ảnh của hệ điều hành. Bạn có thể từ chối hoặc thu hồi quyền trong Settings. Ảnh dùng URL ký có thời hạn khoảng 15 phút; hết hạn URL không có nghĩa ảnh đã bị xóa. Khi chia sẻ, hệ điều hành và ứng dụng nhận được bản sao; ứng dụng không thu hồi được bản sao đó.</Text>
      <Text variant="headline">Xóa và lưu trữ</Text><Text variant="body">Ảnh và dữ liệu nghiệp vụ giữ để phục vụ tủ đồ/Lookbook cho tới khi bạn xóa. Xóa tài khoản khóa truy cập ngay sau biên nhận và dọn dữ liệu bằng worker, thường cần 12–20 phút hoặc lâu hơn khi có lỗi. Máy chủ giữ tombstone/biên nhận tối thiểu chống webhook đến muộn phục hồi tài khoản. Chính sách backup và thời hạn lưu tại từng nhà cung cấp phải được xác nhận trước phát hành.</Text>
    </> : <>
      <Text variant="headline">Sử dụng đúng quyền</Text><Text variant="body">Chỉ tải ảnh bạn có quyền sử dụng và có sự đồng ý của người trong ảnh. Không tải nội dung vi phạm quyền riêng tư hoặc nội dung bị cấm. Thử đồ và tư vấn AI là mô phỏng, có thể sai về chi tiết, màu và độ vừa; hãy tự kiểm tra khi chọn trang phục.</Text>
      <Text variant="headline">Hạn mức thử nghiệm</Text><Text variant="body">Hạn mức và gói lấy từ máy chủ, được làm mới theo tháng UTC. Tạo hình PNG có hạn mức hằng ngày riêng. Không có thanh toán hoặc mua gói trong bản này; hạn mức không cam kết dịch vụ thương mại.</Text>
    </>}
  </Screen>;
}
