import type { UploadAuthResponse } from '@stylist/shared';

type UploadAuth = ReturnType<typeof UploadAuthResponse.parse>;

// Direct upload to ImageKit: the API only signs the request (GET /uploads/auth),
// so the photo never passes through our server.
const ENDPOINT = 'https://upload.imagekit.io/api/v1/files/upload';

export type UploadedFile = { fileId: string; url: string };

export class UploadError extends Error {
  constructor(readonly reason: 'network' | 'rejected' | 'canceled') {
    super(reason);
    this.name = 'UploadError';
  }
}

/** Uses XMLHttpRequest because fetch exposes no upload progress in React Native. */
export function uploadImage(
  file: { uri: string; name: string },
  auth: UploadAuth,
  options: { onProgress?: (fraction: number) => void; signal?: AbortSignal } = {},
): Promise<UploadedFile> {
  return new Promise((resolve, reject) => {
    if (options.signal?.aborted) return reject(new UploadError('canceled'));
    const xhr = new XMLHttpRequest();
    const body = new FormData();
    // React Native's FormData accepts { uri, name, type } for local files.
    body.append('file', { uri: file.uri, name: file.name, type: 'image/jpeg' } as unknown as Blob);
    body.append('fileName', file.name);
    body.append('useUniqueFileName', 'true');
    body.append('publicKey', auth.publicKey);
    body.append('signature', auth.signature);
    body.append('expire', String(auth.expire));
    body.append('token', auth.token);
    // The grant fixes folder and privacy; the API rejects uploads outside them.
    body.append('folder', auth.folder);
    body.append('isPrivateFile', String(auth.isPrivateFile));

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) options.onProgress?.(e.loaded / e.total);
    };
    xhr.onload = () => {
      let json: { fileId?: unknown; url?: unknown } | null = null;
      try {
        json = JSON.parse(xhr.responseText);
      } catch {
        /* handled below */
      }
      if (xhr.status >= 200 && xhr.status < 300 && typeof json?.fileId === 'string' && typeof json?.url === 'string') {
        resolve({ fileId: json.fileId, url: json.url });
      } else {
        reject(new UploadError('rejected'));
      }
    };
    xhr.onerror = () => reject(new UploadError('network'));
    xhr.onabort = () => reject(new UploadError('canceled'));
    options.signal?.addEventListener('abort', () => xhr.abort());

    xhr.open('POST', ENDPOINT);
    xhr.send(body);
  });
}

export function uploadMessage(error: unknown): string | null {
  if (!(error instanceof UploadError)) return null;
  if (error.reason === 'canceled') return 'Đã hủy tải lên.';
  if (error.reason === 'rejected') return 'Máy chủ ảnh từ chối tệp này. Hãy thử ảnh khác.';
  return 'Không tải được ảnh lên. Kiểm tra mạng rồi thử lại.';
}
