import { ApiError, type ErrorCode } from '@stylist/shared';

// API codes come from @stylist/shared; the two client-only codes cover failures with no API body.
export type ClientErrorCode = ErrorCode | 'NETWORK_ERROR' | 'BAD_RESPONSE';

export class RequestError extends Error {
  readonly code: ClientErrorCode;
  readonly status: number | undefined;
  readonly details: unknown;

  constructor(code: ClientErrorCode, status?: number, details?: unknown) {
    super(code);
    this.name = 'RequestError';
    this.code = code;
    this.status = status;
    this.details = details;
  }

  /** Worth retrying automatically: the request may succeed unchanged. */
  get retryable(): boolean {
    return this.code === 'NETWORK_ERROR' || (this.status !== undefined && this.status >= 500);
  }
}

type HttpFailure = { response?: { status: number; data: unknown } };

/** Turn anything thrown by axios (or a schema mismatch) into a RequestError. */
export function toRequestError(error: unknown): RequestError {
  if (error instanceof RequestError) return error;
  const response = (error as HttpFailure | null)?.response;
  if (!response) return new RequestError('NETWORK_ERROR');
  const body = ApiError.safeParse(response.data);
  if (body.success) return new RequestError(body.data.code, response.status, body.data.details);
  return new RequestError(response.status >= 500 ? 'INTERNAL_ERROR' : 'BAD_RESPONSE', response.status);
}

const MESSAGES: Record<ClientErrorCode, string> = {
  UNAUTHORIZED: 'Phiên đăng nhập đã hết. Vui lòng đăng nhập lại.',
  FORBIDDEN: 'Bạn không có quyền thực hiện thao tác này.',
  QUOTA_EXCEEDED: 'Bạn đã dùng hết lượt thử đồ tháng này. Xem ngày làm mới trong phần hạn mức.',
  RATE_LIMITED: 'Bạn thao tác hơi nhanh. Chờ một chút rồi thử lại.',
  NOT_FOUND: 'Không tìm thấy nội dung bạn cần.',
  VALIDATION_ERROR: 'Thông tin gửi đi chưa hợp lệ, vui lòng kiểm tra lại.',
  INTERNAL_ERROR: 'Máy chủ đang gặp sự cố. Vui lòng thử lại sau ít phút.',
  UPLOAD_INVALID: 'Ảnh tải lên không hợp lệ, hãy thử lại.',
  UPLOAD_EXPIRED: 'Phiên tải ảnh đã hết hạn, hãy thử lại.',
  PHOTO_NOT_FULL_BODY: 'Ảnh chưa thấy đủ toàn thân. Lùi ra xa để thấy cả bàn chân rồi chụp lại.',
  PHOTO_MULTIPLE_PEOPLE: 'Ảnh có nhiều người. Hãy chụp ảnh chỉ có mình bạn.',
  PHOTO_NOT_ALLOWED: 'Ảnh này không dùng được để thử đồ. Hãy chọn ảnh khác.',
  PHOTO_NOT_USABLE: 'Ảnh quá tối hoặc mờ. Chụp lại ở nơi đủ sáng nhé.',
  MEDIA_PROCESSING_FAILED: 'AI chưa xử lý được ảnh này. Hãy thử ảnh khác.',
  TRYON_CONTENT_REJECTED: 'Ảnh hoặc món đồ này không xử lý được. Hãy thử đổi ảnh người mẫu hoặc chọn món khác.',
  TRYON_TIMEOUT: 'Thử đồ mất quá lâu. Lượt này đã được hoàn lại, bạn thử lại nhé.',
  TRYON_PROVIDER_ERROR: 'Dịch vụ thử đồ đang gặp sự cố. Lượt này đã được hoàn lại, thử lại sau ít phút.',
  TRYON_INPUT_NOT_READY: 'Ảnh người mẫu hoặc món đồ chưa phân tích xong. Đợi một chút rồi thử lại.',
  TRYON_GARMENT_NOT_ALLOWED: 'Có món đồ không dùng để thử lên ảnh được. Hãy bỏ món đó ra.',
  IDEMPOTENCY_CONFLICT: 'Yêu cầu thử đồ này đã được gửi. Đang mở lại kết quả trước đó.',
  ASSET_QUOTA_EXCEEDED: 'Hôm nay bạn đã dùng hết lượt tạo hình. Lượt mới có vào ngày mai.',
  ASSET_INPUT_INVALID: 'Ảnh hoặc mô tả chưa đủ rõ để tạo hình. Hãy chọn ảnh một món, cắt gọn rồi thử lại.',
  ASSET_PROVIDER_ERROR: 'Dịch vụ tạo hình đang gặp sự cố. Lượt này đã được hoàn lại, thử lại sau ít phút.',
  ASSET_TIMEOUT: 'Tạo hình mất quá lâu. Lượt này đã được hoàn lại, bạn thử lại nhé.',
  ASSET_CONTENT_REJECTED: 'Món đồ hoặc mô tả này không tạo hình được. Hãy thử món hoặc mô tả khác.',
  ASSET_DISABLED: 'Tạo hình cho ma nơ canh đang thử nghiệm và chưa bật cho tài khoản của bạn.',
  NETWORK_ERROR: 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.',
  BAD_RESPONSE: 'Phản hồi từ máy chủ không đúng định dạng.',
};

// QUOTA_EXCEEDED without a known resource is the try-on quota; these caps are not AI or try-on turns.
const QUOTA_BY_RESOURCE: Record<string, string> = {
  stylist: 'Bạn đã dùng hết lượt tư vấn stylist tháng này. Xem ngày làm mới trong phần hạn mức.',
  collections: 'Bạn đã có tối đa 50 bộ sưu tập. Xóa bớt một bộ để tạo bộ mới.',
  planner: 'Lịch đã đủ 730 ngày được lên kế hoạch. Xóa bớt ngày cũ để thêm ngày mới.',
  wear_history: 'Mỗi ngày chỉ ghi tối đa 5 lần đã mặc.',
};

export function messageFor(error: unknown): string {
  const e = toRequestError(error);
  if (e.code === 'RATE_LIMITED' && e.details && typeof e.details === 'object' && 'retryAfterSeconds' in e.details) {
    const seconds = e.details.retryAfterSeconds;
    if (typeof seconds === 'number' && Number.isFinite(seconds) && seconds > 0) return `Chờ khoảng ${Math.ceil(seconds)} giây rồi thử lại.`;
  }
  const details = e.details && typeof e.details === 'object' ? (e.details as Record<string, unknown>) : {};
  if (e.code === 'QUOTA_EXCEEDED' && typeof details.resource === 'string' && details.resource in QUOTA_BY_RESOURCE) return QUOTA_BY_RESOURCE[details.resource];
  if (e.code === 'FORBIDDEN' && typeof details.feature === 'string') return 'Tính năng này chưa có trong gói hiện tại của bạn. Dữ liệu đã lưu vẫn xem và xóa được.';
  return MESSAGES[e.code];
}

/** Stylist jobs only carry an errorCode; QUOTA_EXCEEDED there is always the stylist quota. */
export function stylistJobMessage(code: ErrorCode | null | undefined) {
  return code === 'QUOTA_EXCEEDED' ? messageFor(new RequestError(code, 429, { resource: 'stylist' })) : null;
}
