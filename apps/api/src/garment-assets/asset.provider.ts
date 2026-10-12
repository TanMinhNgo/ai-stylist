import type {
  BodyKey,
  GarmentType,
  IdeaRequest,
  IdeaProposal,
} from '@stylist/shared';
export interface AssetRenderInput {
  type: GarmentType;
  bodyKey: BodyKey;
  prompt: string;
  referenceUrl?: string;
}
export abstract class AssetProvider {
  abstract readonly name: 'openai' | 'fake';
  abstract readonly model: string;
  abstract plan(input: IdeaRequest): Promise<IdeaProposal[]>;
  abstract checkPhoto(url: string, type: GarmentType): Promise<void>;
  abstract generate(input: AssetRenderInput): Promise<Buffer>;
}
export class AssetProviderError extends Error {
  constructor(
    public readonly code:
      | 'ASSET_PROVIDER_ERROR'
      | 'ASSET_CONTENT_REJECTED'
      | 'ASSET_TIMEOUT'
      | 'ASSET_INPUT_INVALID',
    public readonly refundable = false,
    public readonly retryable = false,
  ) {
    super(code);
  }
}
