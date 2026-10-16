import {
  GarmentTags,
  StyleProfile,
  StylistAdvice,
  SuggestOutput,
  AdviceLevel,
} from '@stylist/shared';
export type Candidate = { id: string; tags: GarmentTags; source: string };
export type StylistContext = {
  adviceLevel?: AdviceLevel;
  occasion: string;
  profile: StyleProfile;
  garments: Candidate[];
  liked: unknown[];
};
export abstract class StylistProvider {
  abstract readonly name: 'openai' | 'fake';
  abstract readonly model: string;
  abstract advice(
    context: StylistContext,
    imageUrl: string,
  ): Promise<StylistAdvice>;
  abstract suggest(context: StylistContext): Promise<SuggestOutput>;
}
