// Clerk errors carry their reason in errors[0].code (API errors) or code (client errors).
type ClerkLike = { code?: string; errors?: { code?: string }[] } | null | undefined;

export function clerkCode(error: unknown): string | undefined {
  const e = error as ClerkLike;
  return e?.errors?.[0]?.code ?? e?.code;
}

const MESSAGES: Record<string, string> = {
  form_param_format_invalid: 'Email chưa đúng định dạng.',
  form_param_nil: 'Vui lòng nhập email.',
  form_code_incorrect: 'Mã xác minh không đúng.',
  verification_expired: 'Mã đã hết hạn, hãy gửi lại mã mới.',
  verification_failed: 'Xác minh không thành công, hãy gửi lại mã.',
  too_many_requests: 'Bạn thử quá nhiều lần, vui lòng đợi ít phút.',
  form_identifier_exists: 'Email này đã có tài khoản.',
  network_error: 'Không kết nối được, kiểm tra mạng rồi thử lại.',
};

export function authMessage(error: unknown): string {
  return MESSAGES[clerkCode(error) ?? ''] ?? 'Không đăng nhập được, vui lòng thử lại.';
}
