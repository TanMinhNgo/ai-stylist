import { AiMeter, metered } from '../usage/ai-meter.service';
import { Injectable } from '@nestjs/common';
import OpenAI, { toFile } from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import { z } from 'zod';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  IdeaProposals,
  GARMENT_TYPES,
  type IdeaRequest,
  type GarmentType,
} from '@stylist/shared';
import { RuntimeConfig } from '../config/runtime-config';
import {
  AssetProvider,
  AssetProviderError,
  AssetRenderInput,
} from './asset.provider';
const suitability = z.strictObject({
  allowed: z.boolean(),
  targetVisible: z.boolean(),
  ambiguous: z.boolean(),
});
@Injectable()
export class OpenAiAssetProvider extends AssetProvider {
  readonly name = 'openai' as const;
  get model() {
    return this.config.values.OPENAI_IMAGE_MODEL || '';
  }
  constructor(
    private readonly config: RuntimeConfig,
    private readonly meter?: AiMeter,
  ) {
    super();
  }
  private client() {
    if (!this.config.values.OPENAI_API_KEY)
      throw new AssetProviderError('ASSET_PROVIDER_ERROR', true);
    return new OpenAI({
      apiKey: this.config.values.OPENAI_API_KEY,
      maxRetries: 0,
      timeout: 240000,
    });
  }
  async plan(input: IdeaRequest) {
    const model = this.config.values.OPENAI_VISION_MODEL;
    if (!model) throw new AssetProviderError('ASSET_PROVIDER_ERROR', true);
    try {
      const response = await metered(this.meter, 'vision', model, () =>
        this.client().responses.parse({
          model,
          store: false,
          input: [
            {
              role: 'system',
              content:
                readFileSync(join(__dirname, 'prompts/ideas-v1.md'), 'utf8') +
                '\nType catalog: ' +
                JSON.stringify(GARMENT_TYPES),
            },
            { role: 'user', content: JSON.stringify(input) },
          ],
          text: { format: zodTextFormat(IdeaProposals, 'proposal') },
        }),
      );
      const result = IdeaProposals.parse(response.output_parsed);
      if (
        input.menu !== 'outfit' &&
        (result.items.length !== 1 || result.items[0].type !== input.type)
      )
        throw new AssetProviderError('ASSET_INPUT_INVALID', true);
      return result.items;
    } catch {
      throw new AssetProviderError('ASSET_INPUT_INVALID', true);
    }
  }
  async checkPhoto(url: string, type: GarmentType) {
    const model = this.config.values.OPENAI_VISION_MODEL;
    if (!model) throw new AssetProviderError('ASSET_PROVIDER_ERROR', true);
    try {
      const response = await metered(this.meter, 'vision', model, () =>
        this.client().responses.parse({
          model,
          store: false,
          input: [
            {
              role: 'system',
              content: `Inspect a cropped product photo for target type ${type}. Target must be clearly visible and separable. Multiple possible target items or severe cropping is ambiguous. A matching pair of shoes or earrings counts as one item. A worn item is acceptable if only that selected item can be isolated; no child/unsafe/sexualized imagery. Return allowed, targetVisible, ambiguous.`,
            },
            {
              role: 'user',
              content: [
                { type: 'input_image', image_url: url, detail: 'auto' },
              ],
            },
          ],
          text: { format: zodTextFormat(suitability, 'suitability') },
        }),
      );
      const result = suitability.parse(response.output_parsed);
      if (!result.allowed)
        throw new AssetProviderError('ASSET_CONTENT_REJECTED', true);
      if (!result.targetVisible || result.ambiguous)
        throw new AssetProviderError('ASSET_INPUT_INVALID', true);
    } catch (error) {
      if (error instanceof AssetProviderError) throw error;
      throw new AssetProviderError('ASSET_INPUT_INVALID', true);
    }
  }
  async generate(input: AssetRenderInput) {
    if (!this.model) throw new AssetProviderError('ASSET_PROVIDER_ERROR', true);
    let reference: Awaited<ReturnType<typeof toFile>> | undefined;
    if (input.referenceUrl) {
      try {
        const response = await fetch(input.referenceUrl, {
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
          throw new Error('Invalid reference');
        reference = await toFile(bytes, 'reference.jpg', {
          type: 'image/jpeg',
        });
      } catch {
        throw new AssetProviderError('ASSET_PROVIDER_ERROR', true, true);
      }
    }
    const category = GARMENT_TYPES[input.type][0];
    const size = [
      'top',
      'outerwear',
      'pants',
      'skirt',
      'dress',
      'one_piece',
      'traditional',
    ].includes(category)
      ? '1024x1536'
      : '1024x1024';
    const params = {
      model: this.model,
      n: 1,
      prompt:
        readFileSync(join(__dirname, 'prompts/asset-v1.md'), 'utf8') +
        '\nTarget context: ' +
        JSON.stringify({
          type: input.type,
          bodyKey: input.bodyKey,
          description: input.prompt,
        }),
      size,
      quality: 'medium' as const,
      background: 'transparent' as const,
      output_format: 'png' as const,
    };
    try {
      const client = this.client();
      const response = await metered(this.meter, 'image', this.model, () =>
        reference
          ? client.images.edit({ ...params, image: reference })
          : client.images.generate(params),
      );
      const encoded = response.data?.[0]?.b64_json;
      if (!encoded || encoded.length > 28 * 1024 * 1024)
        throw new AssetProviderError('ASSET_INPUT_INVALID');
      return Buffer.from(encoded, 'base64');
    } catch (error) {
      if (error instanceof AssetProviderError) throw error;
      if (
        error instanceof OpenAI.APIError &&
        error.code === 'content_policy_violation'
      )
        throw new AssetProviderError('ASSET_CONTENT_REJECTED', true);
      if (error instanceof OpenAI.APIConnectionTimeoutError)
        throw new AssetProviderError('ASSET_TIMEOUT');
      const rateLimited =
        error instanceof OpenAI.APIError && error.status === 429;
      const rejected =
        error instanceof OpenAI.APIError &&
        typeof error.status === 'number' &&
        [400, 401, 403, 404, 413, 422].includes(error.status);
      throw new AssetProviderError(
        'ASSET_PROVIDER_ERROR',
        rateLimited || rejected,
        rateLimited,
      );
    }
  }
}
