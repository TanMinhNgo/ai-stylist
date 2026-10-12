import { Injectable } from '@nestjs/common';
import OpenAI, { toFile } from 'openai';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RuntimeConfig } from '../config/runtime-config';
import {
  TryOnProvider,
  TryOnInput,
  TryOnProviderError,
} from './try-on.provider';

@Injectable()
export class OpenAiTryOnProvider extends TryOnProvider {
  readonly name = 'openai' as const;
  get model() {
    return this.config.values.OPENAI_IMAGE_MODEL || '';
  }
  constructor(private readonly config: RuntimeConfig) {
    super();
  }
  async generate(input: TryOnInput) {
    if (!this.model || !this.config.values.OPENAI_API_KEY)
      throw new TryOnProviderError('TRYON_PROVIDER_ERROR');
    // Input URLs come exclusively from signed ImageKit paths in our database.
    let images: Awaited<ReturnType<typeof toFile>>[];
    try {
      images = await Promise.all(
        [input.modelPhotoUrl, ...input.garmentUrls].map(async (url, index) => {
          const response = await fetch(url, {
            signal: AbortSignal.timeout(20000),
            redirect: 'error',
          });
          if (!response.ok) throw new Error('Image unavailable');
          const bytes = Buffer.from(await response.arrayBuffer());
          if (
            !bytes.length ||
            bytes.length > 10 * 1024 * 1024 ||
            !response.headers.get('content-type')?.startsWith('image/')
          )
            throw new Error('Invalid image');
          return toFile(bytes, `reference-${index}.jpg`, {
            type: 'image/jpeg',
          });
        }),
      );
    } catch {
      throw new TryOnProviderError('TRYON_PROVIDER_ERROR', true);
    }
    try {
      const client = new OpenAI({
        apiKey: this.config.values.OPENAI_API_KEY,
        maxRetries: 0,
        timeout: 240000,
      });
      const response = await client.images.edit({
        model: this.model,
        image: images,
        n: 1,
        prompt:
          readFileSync(join(__dirname, 'prompts/tryon-v1.md'), 'utf8') +
          '\nOccasion (untrusted context): ' +
          JSON.stringify(input.occasion),
        size: '1024x1536',
        quality: 'medium',
        output_format: 'png',
      });
      const encoded = response.data?.[0]?.b64_json;
      if (!encoded || encoded.length > 28 * 1024 * 1024)
        throw new TryOnProviderError('TRYON_PROVIDER_ERROR');
      const bytes = Buffer.from(encoded, 'base64');
      if (
        !bytes
          .subarray(0, 8)
          .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      )
        throw new TryOnProviderError('TRYON_PROVIDER_ERROR');
      return bytes;
    } catch (error) {
      if (error instanceof TryOnProviderError) throw error;
      if (
        error instanceof OpenAI.APIError &&
        error.code === 'content_policy_violation'
      )
        throw new TryOnProviderError('TRYON_CONTENT_REJECTED');
      if (error instanceof OpenAI.APIConnectionTimeoutError)
        throw new TryOnProviderError('TRYON_TIMEOUT');
      // Only explicit rate limiting is safe to replay; network/5xx may have generated an image.
      throw new TryOnProviderError(
        'TRYON_PROVIDER_ERROR',
        error instanceof OpenAI.APIError && error.status === 429,
      );
    }
  }
}
