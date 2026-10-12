import OpenAI from 'openai';
import { RuntimeConfig } from '../config/runtime-config';
import { OpenAiAssetProvider } from './openai-asset.provider';

describe('Asset provider billing and ambiguous receipts', () => {
  const provider = new OpenAiAssetProvider({
    values: {
      OPENAI_API_KEY: 'fixture',
      OPENAI_IMAGE_MODEL: 'configured-model',
    },
  } as RuntimeConfig);
  const input = {
    type: 'ring' as const,
    bodyKey: 'f' as const,
    prompt: 'silver ring',
  };
  const generate = jest.fn();
  beforeEach(() => {
    jest
      .spyOn(OpenAI.Images.prototype, 'generate')
      .mockImplementation(generate);
  });
  afterEach(() => {
    jest.restoreAllMocks();
    jest.resetAllMocks();
  });
  it.each([
    [400, true, false],
    [401, true, false],
    [429, true, true],
    [500, false, false],
  ])(
    'HTTP %s refunds=%s and retry=%s without exposing provider details',
    async (status, refundable, retryable) => {
      generate.mockRejectedValue(
        new OpenAI.APIError(
          status,
          { message: 'private details' },
          'private details',
          new Headers(),
        ),
      );
      await expect(provider.generate(input)).rejects.toMatchObject({
        code: 'ASSET_PROVIDER_ERROR',
        refundable,
        retryable,
      });
    },
  );
  it('does not refund or replay a timeout after sending an image request', async () => {
    generate.mockRejectedValue(new OpenAI.APIConnectionTimeoutError());
    await expect(provider.generate(input)).rejects.toMatchObject({
      code: 'ASSET_TIMEOUT',
      refundable: false,
      retryable: false,
    });
  });
  it('asks for a transparent square PNG for jewelry using the existing model', async () => {
    generate.mockResolvedValue({
      data: [{ b64_json: Buffer.from('synthetic PNG').toString('base64') }],
    });
    await provider.generate(input);
    expect(generate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'configured-model',
        n: 1,
        background: 'transparent',
        output_format: 'png',
        size: '1024x1024',
      }),
    );
  });
});
