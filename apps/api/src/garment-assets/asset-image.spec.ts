import sharp from 'sharp';
import { AssetImage } from './asset-image';
import { FakeAssetProvider } from './fake-asset.provider';
import { assetDay } from './asset-time';
describe('Mannequin PNG normalization and quota clock', () => {
  const image = new AssetImage();
  it('normalizes an alpha cutout without flattening and returns bounded metadata', async () => {
    const result = await image.normalize(
      await new FakeAssetProvider().generate(),
      'shirt',
    );
    expect(result.meta.width).toBe(1024);
    expect(result.meta.height).toBe(1536);
    const { data, info } = await sharp(result.image)
      .raw()
      .toBuffer({ resolveWithObject: true });
    expect(info.channels).toBe(4);
    expect(data[3]).toBe(0);
    const [x, y, w, h] = result.meta.bounds;
    expect(x).toBeGreaterThanOrEqual(0);
    expect(y).toBeGreaterThanOrEqual(0);
    expect(x + w).toBeLessThanOrEqual(1024);
    expect(y + h).toBeLessThanOrEqual(1536);
  });
  it('uses a square canvas for jewelry', async () => {
    expect(
      (await image.normalize(await new FakeAssetProvider().generate(), 'ring'))
        .meta.height,
    ).toBe(1024);
  });
  it('rejects opaque and empty images instead of producing a background rectangle', async () => {
    const opaque = await sharp({
      create: {
        width: 128,
        height: 128,
        channels: 4,
        background: { r: 1, g: 2, b: 3, alpha: 1 },
      },
    })
      .png()
      .toBuffer();
    const empty = await sharp({
      create: {
        width: 128,
        height: 128,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .png()
      .toBuffer();
    await expect(image.normalize(opaque, 'shirt')).rejects.toThrow(
      'ASSET_INPUT_INVALID',
    );
    await expect(image.normalize(empty, 'shirt')).rejects.toThrow(
      'ASSET_INPUT_INVALID',
    );
  });
  it('resets at Vietnam midnight independently from machine timezone', () => {
    expect(assetDay(new Date('2026-10-12T16:59:59Z')).day).toBe('2026-10-12');
    const after = assetDay(new Date('2026-10-12T17:00:00Z'));
    expect(after.day).toBe('2026-10-13');
    expect(after.resetAt.toISOString()).toBe('2026-10-13T17:00:00.000Z');
  });
});
