import type { GarmentTags, ModelPhotoAnalysis } from '@stylist/shared';

export abstract class VisionProvider {
  abstract modelPhoto(url: string): Promise<ModelPhotoAnalysis>;
  abstract garment(url: string): Promise<GarmentTags>;
  abstract embedding(description: string): Promise<number[]>;
}
