export interface TryOnInput {
  modelPhotoUrl: string;
  garmentUrls: string[];
  occasion: string;
}
export abstract class TryOnProvider {
  abstract readonly name: 'openai' | 'fake';
  abstract readonly model: string;
  abstract generate(input: TryOnInput): Promise<Buffer>;
}
export class TryOnProviderError extends Error {
  constructor(
    public readonly code:
      'TRYON_CONTENT_REJECTED' | 'TRYON_TIMEOUT' | 'TRYON_PROVIDER_ERROR',
    public readonly retryable = false,
  ) {
    super(code);
  }
}
