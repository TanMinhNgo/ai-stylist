import sharp from 'sharp';
import {
  GenerationType,
  type IdeaRequest,
  type IdeaProposal,
  type GarmentType,
} from '@stylist/shared';
import { AssetProvider } from './asset.provider';
export class FakeAssetProvider extends AssetProvider {
  readonly name = 'fake' as const;
  readonly model = 'fake';
  plan(input: IdeaRequest): Promise<IdeaProposal[]> {
    const types: readonly GarmentType[] =
      input.menu === 'outfit'
        ? (['shirt', 'blazer', 'trousers', 'loafers'] as const)
        : [GenerationType.parse(input.type)];
    return Promise.resolve(
      types.map((type) => ({
        label: `Mẫu thử ${type}`,
        type,
        prompt: input.prompt,
      })),
    );
  }
  checkPhoto(): Promise<void> {
    return Promise.resolve();
  }
  generate(): Promise<Buffer> {
    return sharp({
      create: {
        width: 128,
        height: 128,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite([
        {
          input: Buffer.from(
            '<svg width="128" height="128"><rect x="24" y="16" width="80" height="96" rx="8" fill="#253858"/></svg>',
          ),
        },
      ])
      .png()
      .toBuffer();
  }
}
