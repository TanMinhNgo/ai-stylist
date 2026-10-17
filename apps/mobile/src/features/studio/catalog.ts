// Bundled demo pieces: only the tags of packages/shared/assets manifests (copied by hand); their PNGs are not used.
// Never Garment resources: no API ids, never sent to /try-on or saved to the wardrobe.
import type { BodyKey } from '@stylist/shared';

import formal from '@/assets/formalwear/manifest.json';
import wardrobe from '@/assets/wardrobe/manifest.json';
import casual from '@/assets/wardrobe/casual-outfits.json';
import { casualOutfits, type DemoOutfit, type Wearable } from '@/features/studio/outfit';
export type { DemoOutfit } from '@/features/studio/outfit';

export const DEMO_ITEMS: Wearable[] = wardrobe.items.map((i) => ({
  id: `demo:${i.id}`,
  label: i.label,
  tags: i.lookTags,
  garmentId: null,
  tryOnAllowed: false,
}));

export const CASUAL_OUTFITS: DemoOutfit[] = casualOutfits(casual.items, DEMO_ITEMS);

/** Formalwear: designed for one body, which the outfit switches to. */
export const DEMO_OUTFITS: DemoOutfit[] = formal.items.map((o) => ({
  id: o.id, label: o.label, bodyKey: o.bodyKey as BodyKey,
  members: o.lookTags.map((t, n) => ({ id: `demo:${o.id}:${n}`, label: o.label, tags: t, garmentId: null, tryOnAllowed: false })),
}));
