import { AiMeter, metered } from '../usage/ai-meter.service';
import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import { z } from 'zod';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { StylistAdvice, SuggestOutput } from '@stylist/shared';
import { RuntimeConfig } from '../config/runtime-config';
import { StylistProvider, StylistContext } from './stylist.provider';
@Injectable()
export class OpenAiStylistProvider extends StylistProvider {
  readonly name = 'openai' as const;
  get model() {
    return this.config.values.OPENAI_VISION_MODEL || '';
  }
  constructor(
    private readonly config: RuntimeConfig,
    private readonly meter?: AiMeter,
  ) {
    super();
  }
  private async generate<T>(
    context: StylistContext,
    schema: z.ZodType<T>,
    kind: 'ADVICE' | 'SUGGEST',
    imageUrl?: string,
  ) {
    if (!this.config.values.OPENAI_API_KEY || !this.model)
      throw new ServiceUnavailableException();
    const client = new OpenAI({
      apiKey: this.config.values.OPENAI_API_KEY,
      maxRetries: 0,
      timeout: 60000,
    });
    const knowledge = [
      'colors-v1',
      'occasion-v1',
      ...(context.profile.bodyShape ? ['proportion-v1'] : []),
    ]
      .map((name) =>
        readFileSync(join(__dirname, `knowledge/${name}.md`), 'utf8'),
      )
      .join('\n');
    const prompt =
      readFileSync(join(__dirname, 'prompts/stylist-v1.md'), 'utf8') +
      '\n' +
      kind +
      '\n' +
      knowledge;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await metered(this.meter, 'stylist', this.model, () =>
          client.responses.parse({
            model: this.model,
            store: false,
            input: [
              { role: 'system', content: prompt },
              {
                role: 'user',
                content: [
                  { type: 'input_text', text: JSON.stringify(context) },
                  ...(imageUrl
                    ? [
                        {
                          type: 'input_image' as const,
                          image_url: imageUrl,
                          detail: 'auto' as const,
                        },
                      ]
                    : []),
                ],
              },
            ],
            text: { format: zodTextFormat(schema, 'stylist') },
          }),
        );
        return schema.parse(response.output_parsed);
      } catch (error) {
        if (!(error instanceof z.ZodError) || attempt === 1) throw error;
      }
    }
    throw new Error('Stylist output invalid');
  }
  advice(context: StylistContext, imageUrl: string) {
    return this.generate(context, StylistAdvice, 'ADVICE', imageUrl);
  }
  suggest(context: StylistContext) {
    return this.generate(context, SuggestOutput, 'SUGGEST');
  }
}
