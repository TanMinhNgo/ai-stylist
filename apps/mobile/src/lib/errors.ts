import { ApiError, type ErrorCode } from '@stylist/shared';

// API codes come from @stylist/shared; the two client-only codes cover failures with no API body.
export type ClientErrorCode = ErrorCode | 'NETWORK_ERROR' | 'BAD_RESPONSE';

export class RequestError extends Error {
  readonly code: ClientErrorCode;
  readonly status: number | undefined;

  constructor(code: ClientErrorCode, status?: number) {
    super(code);
    this.name = 'RequestError';
    this.code = code;
    this.status = status;
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
  if (body.success) return new RequestError(body.data.code, response.status);
  return new RequestError(response.status >= 500 ? 'INTERNAL_ERROR' : 'BAD_RESPONSE', response.status);
}

const MESSAGES: Record<ClientErrorCode, string> = {
  UNAUTHORIZED: 'Phiên đăng nhập đã hết. Vui lòng đăng nhập lại.',
  FORBIDDEN: 'Bạn không có quyền thực hiện thao tác này.',
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
  NETWORK_ERROR: 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.',
  BAD_RESPONSE: 'Phản hồi từ máy chủ không đúng định dạng.',
};

export function messageFor(error: unknown): string {
  return MESSAGES[toRequestError(error).code];
}
