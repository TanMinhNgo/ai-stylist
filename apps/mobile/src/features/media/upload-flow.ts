import { UploadAuthResponse } from '@stylist/shared';

import { request, type Schema } from '@/lib/api';
import { messageFor } from '@/lib/errors';
import { prepareForUpload, type LocalImage } from '@/lib/image';
import { uploadImage, uploadMessage } from '@/lib/upload';

/**
 * resize → one-time grant (GET /uploads/auth) → ImageKit → POST /<kind>, parsed with `schema`.
 * `extra` adds endpoint-specific fields (garments: generateAsset/bodyKey/requestedType). Every step stops on `signal`; the grant is single-use, so retries start from the top.
 */
export async function uploadMedia<T>(
  kind: 'model-photos' | 'garments',
  schema: Schema<T>,
  image: LocalImage,
  { onProgress, signal, extra }: { onProgress?: (fraction: number) => void; signal?: AbortSignal; extra?: Record<string, unknown> } = {},
): Promise<T> {
  const prepared = await prepareForUpload(image);
  const auth = await request(UploadAuthResponse, { url: '/uploads/auth', signal });
  const name = `${kind === 'model-photos' ? 'model' : 'garment'}-${Date.now()}.jpg`;
  const file = await uploadImage({ uri: prepared.uri, name }, auth, { onProgress, signal });
  return request(schema, {
    url: `/${kind}`,
    method: 'POST',
    data: { imagekitFileId: file.fileId, url: file.url, uploadToken: auth.token, ...extra },
    signal,
  });
}

export function uploadFlowMessage(error: unknown): string {
  return uploadMessage(error) ?? messageFor(error);
}
