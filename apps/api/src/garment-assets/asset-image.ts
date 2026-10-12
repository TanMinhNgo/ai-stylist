import { Injectable } from '@nestjs/common';
import sharp from 'sharp';
import { GARMENT_TYPES, type GarmentType } from '@stylist/shared';
import { AssetProviderError } from './asset.provider';
export interface RenderMeta {
  width: number;
  height: number;
  bounds: [number, number, number, number];
}
@Injectable()
export class AssetImage {
  async normalize(
    bytes: Buffer,
    type: GarmentType,
  ): Promise<{ image: Buffer; meta: RenderMeta }> {
    if (bytes.length > 20 * 1024 * 1024)
      throw new AssetProviderError('ASSET_INPUT_INVALID');
    const source = sharp(bytes, { limitInputPixels: 16 * 1024 * 1024 });
    const info = await source.metadata();
    if (info.format !== 'png' || !info.hasAlpha || (info.pages ?? 1) > 1)
      throw new AssetProviderError('ASSET_INPUT_INVALID');
    const raw = await source
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    let left = raw.info.width,
      top = raw.info.height,
      right = -1,
      bottom = -1,
      transparent = 0;
    for (let y = 0; y < raw.info.height; y++)
      for (let x = 0; x < raw.info.width; x++) {
        const a = raw.data[(y * raw.info.width + x) * 4 + 3];
        if (a < 16) transparent++;
        if (a > 16) {
          left = Math.min(left, x);
          top = Math.min(top, y);
          right = Math.max(right, x);
          bottom = Math.max(bottom, y);
        }
      }
    if (
      right < left ||
      bottom < top ||
      transparent < raw.info.width * raw.info.height * 0.01
    )
      throw new AssetProviderError('ASSET_INPUT_INVALID');
    const category = GARMENT_TYPES[type][0];
    const height = [
      'top',
      'outerwear',
      'pants',
      'skirt',
      'dress',
      'one_piece',
      'traditional',
    ].includes(category)
      ? 1536
      : 1024;
    const resized = await sharp(bytes, { limitInputPixels: 16 * 1024 * 1024 })
      .extract({ left, top, width: right - left + 1, height: bottom - top + 1 })
      .resize(896, height - 128, { fit: 'inside' })
      .png()
      .toBuffer({ resolveWithObject: true });
    const x = Math.floor((1024 - resized.info.width) / 2),
      y = Math.floor((height - resized.info.height) / 2);
    const image = await sharp(resized.data)
      .extend({
        left: x,
        right: 1024 - resized.info.width - x,
        top: y,
        bottom: height - resized.info.height - y,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer();
    return {
      image,
      meta: {
        width: 1024,
        height,
        bounds: [x, y, resized.info.width, resized.info.height],
      },
    };
  }
}
