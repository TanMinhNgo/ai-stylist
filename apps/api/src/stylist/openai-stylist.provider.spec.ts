import OpenAI from 'openai';
import { OpenAiStylistProvider } from './openai-stylist.provider';
import { RuntimeConfig } from '../config/runtime-config';
import { StylistAdvice, StyleProfile } from '@stylist/shared';
const profile = StyleProfile.parse({
  styles: [],
  occasions: [],
  budget: null,
  preferredColors: [],
  avoidedColors: [],
  bodyShape: null,
  skinTone: null,
  updatedAt: null,
});
const advice = StylistAdvice.parse({
  summary: 'Phối màu cân bằng.',
  strengths: ['Màu trung tính dễ phối.'],
  adjustments: [],
  accessories: [],
  occasionFit: { score: 4, reason: 'Phù hợp dịp.' },
});
describe('Structured stylist output', () => {
  const provider = new OpenAiStylistProvider({
    values: {
      OPENAI_API_KEY: 'fixture',
      OPENAI_VISION_MODEL: 'configured-model',
    },
  } as RuntimeConfig);
  const context = { occasion: 'đi làm', profile, garments: [], liked: [] };
  const parse = jest.fn();
  beforeEach(() => {
    jest.spyOn(OpenAI.Responses.prototype, 'parse').mockImplementation(parse);
  });
  afterEach(() => {
    jest.restoreAllMocks();
    jest.resetAllMocks();
  });
  it('retries malformed structured output once and uses the existing model', async () => {
    parse
      .mockResolvedValueOnce({ output_parsed: { summary: 'invalid' } })
      .mockResolvedValueOnce({ output_parsed: advice });
    expect(
      await provider.advice(context, 'https://example.com/private'),
    ).toEqual(advice);
    expect(parse).toHaveBeenCalledTimes(2);
    expect(parse).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'configured-model', store: false }),
    );
  });
  it('fails after two schema errors without an endless retry loop', async () => {
    parse.mockResolvedValue({ output_parsed: null });
    await expect(
      provider.advice(context, 'https://example.com/private'),
    ).rejects.toThrow();
    expect(parse).toHaveBeenCalledTimes(2);
  });
  it('does not repeat ambiguous network failures', async () => {
    parse.mockRejectedValue(new Error('private connection details'));
    await expect(
      provider.advice(context, 'https://example.com/private'),
    ).rejects.toThrow();
    expect(parse).toHaveBeenCalledTimes(1);
  });
  it.each(['basic', 'advanced'] as const)(
    'puts the trusted %s level and matching output constraints in the system request',
    async (adviceLevel) => {
      parse.mockResolvedValue({ output_parsed: advice });
      await provider.advice(
        { ...context, adviceLevel },
        'https://example.com/private',
      );
      const request = (parse.mock.calls as unknown[][])[0][0] as {
        input: { content: unknown }[];
        text: {
          format: {
            schema: { properties: Record<string, { maxItems: number }> };
          };
        };
      };
      expect(request.input[0].content).toContain(`ADVICE_LEVEL=${adviceLevel}`);
      expect(request.text.format.schema.properties.accessories.maxItems).toBe(
        adviceLevel === 'basic' ? 0 : 4,
      );
    },
  );
});
