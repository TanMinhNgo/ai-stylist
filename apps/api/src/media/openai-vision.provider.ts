import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import { z } from 'zod';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  GarmentTags,
  GarmentTagsOutput,
  ModelPhotoAnalysis,
  EMBEDDING_DIMENSIONS,
  GARMENT_TYPES,
} from '@stylist/shared';
import { RuntimeConfig } from '../config/runtime-config';
import { VisionProvider } from './vision.provider';

@Injectable()
export class OpenAiVisionProvider extends VisionProvider {
  constructor(private readonly config: RuntimeConfig) {
    super();
  }
  private get client() {
    const apiKey = this.config.values.OPENAI_API_KEY;
    if (!apiKey) throw new ServiceUnavailableException();
    return new OpenAI({ apiKey, maxRetries: 1, timeout: 60000 });
  }
  private async analyze<T>(url: string, schema: z.ZodType<T>, prompt: string) {
    const model = this.config.values.OPENAI_VISION_MODEL;
    if (!model) throw new ServiceUnavailableException();
    const response = await this.client.responses.parse({
      model,
      store: false,
      input: [
        { role: 'system', content: prompt },
        {
          role: 'user',
          content: [{ type: 'input_image', image_url: url, detail: 'auto' }],
        },
      ],
      text: { format: zodTextFormat(schema, 'analysis') },
    });
    return schema.parse(response.output_parsed);
  }
  modelPhoto(url: string) {
    return this.analyze(
      url,
      ModelPhotoAnalysis,
      readFileSync(join(__dirname, 'prompts/photo-v1.md'), 'utf8'),
    );
  }
  async garment(url: string) {
    const prompt =
      readFileSync(join(__dirname, 'prompts/garment-v1.md'), 'utf8') +
      '\nType catalog [category, slot]:\n' +
      JSON.stringify(GARMENT_TYPES);
    return GarmentTags.parse(
      await this.analyze(url, GarmentTagsOutput, prompt),
    );
  }
  async embedding(description: string) {
    const model = this.config.values.OPENAI_EMBEDDING_MODEL;
    if (!model) throw new ServiceUnavailableException();
    const response = await this.client.embeddings.create({
      model,
      input: description,
      dimensions: EMBEDDING_DIMENSIONS,
    });
    return z
      .array(z.number().finite())
      .length(EMBEDDING_DIMENSIONS)
      .parse(response.data[0]?.embedding);
  }
}
