import OpenAI from 'openai';
import { RuntimeConfig } from '../config/runtime-config';
import { OpenAiTryOnProvider } from './openai-try-on.provider';
import { FakeTryOnProvider } from './fake-try-on.provider';
import { TryOnProviderError } from './try-on.provider';

describe('OpenAI try-on adapter', () => {
  const config = {
    values: {
      OPENAI_API_KEY: 'fixture',
      OPENAI_IMAGE_MODEL: 'configured-image-model',
    },
  } as RuntimeConfig;
  const provider = new OpenAiTryOnProvider(config);
  const input = {
    modelPhotoUrl: 'https://images.example.com/photo',
    garmentUrls: ['https://images.example.com/garment'],
    occasion: 'đi làm',
  };
  const fetchMock = jest.fn();
  const edit = jest.fn();
  const originalFetch = global.fetch;
  beforeEach(() => {
    global.fetch = fetchMock;
    fetchMock.mockImplementation(() =>
      Promise.resolve(
        new Response(Buffer.from('image'), {
          headers: { 'content-type': 'image/jpeg' },
        }),
      ),
    );
    jest.spyOn(OpenAI.Images.prototype, 'edit').mockImplementation(edit);
  });
  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
    jest.resetAllMocks();
  });
  it('uses configured image model, multiple references and PNG output', async () => {
    const png = await new FakeTryOnProvider().generate();
    edit.mockResolvedValue({ data: [{ b64_json: png.toString('base64') }] });
    expect(await provider.generate(input)).toEqual(png);
    expect(edit).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'configured-image-model',
        n: 1,
        quality: 'medium',
        size: '1024x1536',
        output_format: 'png',
      }),
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it('allows retry when reference fetching fails before making an AI request', async () => {
    fetchMock.mockRejectedValue(new Error('private signed URL'));
    await expect(provider.generate(input)).rejects.toMatchObject({
      code: 'TRYON_PROVIDER_ERROR',
      retryable: true,
    });
    expect(edit).not.toHaveBeenCalled();
  });
  it.each([
    [429, undefined, 'TRYON_PROVIDER_ERROR', true],
    [400, 'content_policy_violation', 'TRYON_CONTENT_REJECTED', false],
    [500, undefined, 'TRYON_PROVIDER_ERROR', false],
  ])(
    'maps HTTP %s to safe provider codes',
    async (status, code, expected, retryable) => {
      edit.mockRejectedValue(
        new OpenAI.APIError(
          status,
          { code, message: 'private provider details' },
          'private provider details',
          new Headers(),
        ),
      );
      await expect(provider.generate(input)).rejects.toMatchObject({
        code: expected,
        retryable,
      });
    },
  );
  it('does not replay ambiguous network timeouts', async () => {
    edit.mockRejectedValue(new OpenAI.APIConnectionTimeoutError());
    await expect(provider.generate(input)).rejects.toMatchObject({
      code: 'TRYON_TIMEOUT',
      retryable: false,
    });
  });
  it('rejects malformed image outputs without returning provider messages', async () => {
    edit.mockResolvedValue({
      data: [
        { b64_json: Buffer.from('private invalid output').toString('base64') },
      ],
    });
    await expect(provider.generate(input)).rejects.toBeInstanceOf(
      TryOnProviderError,
    );
  });
});
