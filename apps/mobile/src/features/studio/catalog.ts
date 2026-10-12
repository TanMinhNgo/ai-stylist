// Bundled demo pieces (copied from packages/shared/assets by hand, see progress/frontend.md).
// Never Garment resources: no API ids, never sent to /try-on or saved to the wardrobe.
import type { BodyKey } from '@stylist/shared';

import formal from '@/assets/formalwear/manifest.json';
import wardrobe from '@/assets/wardrobe/manifest.json';
import casual from '@/assets/wardrobe/casual-outfits.json';
import { casualOutfits, type DemoOutfit, type Wearable } from '@/features/studio/outfit';
export type { DemoOutfit } from '@/features/studio/outfit';

// Metro needs literal requires; keys are the manifest `file` names.
const FILES: Record<string, number> = {
  'white-shirt.png': require('@/assets/wardrobe/white-shirt.png'),
  'white-tee.png': require('@/assets/wardrobe/white-tee.png'),
  'champagne-blouse.png': require('@/assets/wardrobe/champagne-blouse.png'),
  'navy-blazer-overlay.png': require('@/assets/wardrobe/navy-blazer-overlay.png'),
  'navy-trousers.png': require('@/assets/wardrobe/navy-trousers.png'),
  'blue-jeans.png': require('@/assets/wardrobe/blue-jeans.png'),
  'pleated-skirt.png': require('@/assets/wardrobe/pleated-skirt.png'),
  'black-midi-dress.png': require('@/assets/wardrobe/black-midi-dress.png'),
  'black-loafers.png': require('@/assets/wardrobe/black-loafers.png'),
  'tan-crossbody.png': require('@/assets/wardrobe/tan-crossbody.png'),
  'beige-fedora.png': require('@/assets/wardrobe/beige-fedora.png'),
  'black-belt.png': require('@/assets/wardrobe/black-belt.png'),
  'gold-glasses.png': require('@/assets/wardrobe/gold-glasses.png'),
  'burgundy-scarf.png': require('@/assets/wardrobe/burgundy-scarf.png'),
  'gold-necklace.png': require('@/assets/wardrobe/gold-necklace.png'),
  'pearl-earrings.png': require('@/assets/wardrobe/pearl-earrings.png'),
  'gold-bracelet.png': require('@/assets/wardrobe/gold-bracelet.png'),
  'silver-ring.png': require('@/assets/wardrobe/silver-ring.png'),
  'black-oversized-tee.png': require('@/assets/wardrobe/black-oversized-tee.png'),
  'navy-polo.png': require('@/assets/wardrobe/navy-polo.png'),
  'grey-hoodie.png': require('@/assets/wardrobe/grey-hoodie.png'),
  'cream-sweater.png': require('@/assets/wardrobe/cream-sweater.png'),
  'blue-denim-jacket-overlay.png': require('@/assets/wardrobe/blue-denim-jacket-overlay.png'),
  'khaki-shorts.png': require('@/assets/wardrobe/khaki-shorts.png'),
  'olive-cargo.png': require('@/assets/wardrobe/olive-cargo.png'),
  'black-joggers.png': require('@/assets/wardrobe/black-joggers.png'),
  'white-sneakers.png': require('@/assets/wardrobe/white-sneakers.png'),
  'black-chunky-sneakers.png': require('@/assets/wardrobe/black-chunky-sneakers.png'),
  'color-sport-sneakers.png': require('@/assets/wardrobe/color-sport-sneakers.png'),
  'brown-sandals.png': require('@/assets/wardrobe/brown-sandals.png'),
  'black-slides.png': require('@/assets/wardrobe/black-slides.png'),
  'navy-cap.png': require('@/assets/wardrobe/navy-cap.png'),
  'cream-cap.png': require('@/assets/wardrobe/cream-cap.png'),
  'grey-beanie.png': require('@/assets/wardrobe/grey-beanie.png'),
  'navy-business.png': require('@/assets/formalwear/navy-business.png'),
  'charcoal-pinstripe.png': require('@/assets/formalwear/charcoal-pinstripe.png'),
  'black-tuxedo.png': require('@/assets/formalwear/black-tuxedo.png'),
  'ivory-womens-suit.png': require('@/assets/formalwear/ivory-womens-suit.png'),
};

// Both manifests: bounds = [left, top, width, height] of alpha>16 pixels.
type Box = [number, number, number, number];

export const DEMO_ITEMS: Wearable[] = wardrobe.items.map((i) => ({
  id: `demo:${i.id}`,
  label: i.label,
  tags: i.lookTags,
  garmentId: null,
  tryOnAllowed: false,
  sprite: { source: FILES[i.file], width: i.width, height: i.height, bounds: i.bounds as Box, bodyKeys: i.bodyKeys as BodyKey[] },
}));

export const CASUAL_OUTFITS: DemoOutfit[] = casualOutfits(casual.items, DEMO_ITEMS);

/** Formalwear: one PNG per full outfit; its lookTags become 3D proxies for the rotating view. */
export const DEMO_OUTFITS: DemoOutfit[] = formal.items.map((o) => {
  const bodyKey = o.bodyKey as BodyKey;
  const sprite = { source: FILES[o.file], width: o.width, height: o.height, bounds: o.bounds as Box,bodyKeys: [bodyKey] };
  const members = o.lookTags.map((t, n) => ({ id: `demo:${o.id}:${n}`, label: o.label, tags: t, garmentId: null, tryOnAllowed: false, sprite: null, preset: o.id }));
  return { id: o.id, label: o.label, bodyKey, image: FILES[o.file], preset: { id: o.id, sprite, size: members.length }, members };
});
