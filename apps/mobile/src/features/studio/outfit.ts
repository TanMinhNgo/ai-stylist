// What the mannequin wears. Pure (three only), tested in test/outfit.test.mjs.
import type { BodyKey, Garment } from '@stylist/shared';
import * as THREE from 'three';

import { TYPE_LABEL } from '../garments/labels.ts';
import { lookFor, type Look } from './looks.ts';

type Tags = Parameters<typeof lookFor>[0];

/** Anything the mannequin can wear: a real Garment (garmentId set) or a bundled demo piece (garmentId null, never sent to the API). */
export type Wearable = { id: string; label: string; tags: Tags; garmentId: string | null; tryOnAllowed: boolean };
export type Picks = Record<string, Wearable>;
/** bodyKey set: the outfit was designed for that body and switches to it; null keeps the current body. */
export type DemoOutfit = { id: string; label: string; bodyKey: BodyKey | null; members: Wearable[] };

/** Separate pieces, so casual outfits keep the current body. */
export function casualOutfits(definitions: { id: string; label: string; itemIds: string[] }[], items: Wearable[]): DemoOutfit[] {
  return definitions.map((o) => ({
    id: o.id, label: o.label, bodyKey: null,
    members: o.itemIds.map((id) => {
      const item = items.find((w) => w.id === `demo:${id}` && w.garmentId === null && !w.tryOnAllowed);
      if (!item) throw new Error(`Missing demo item: ${id}`);
      return item;
    }),
  }));
}

/** Selection key: one piece per slot, except jewelry where earrings, ring, bracelet and necklace can be worn together. */
export const pickKey = (tags: { slot: string; type: string }) => (tags.slot === 'jewelry' ? `jewelry:${tags.type}` : tags.slot);

export function togglePick(picks: Picks, w: Wearable): Picks {
  const key = pickKey(w.tags);
  const next = { ...picks };
  if (next[key]?.id === w.id) {
    delete next[key];
    return next;
  }
  next[key] = w;
  // A dress (or jumpsuit, áo dài) replaces top and bottom, and the other way round.
  if (key === 'dress') {
    delete next.top;
    delete next.bottom;
  }
  if (key === 'top' || key === 'bottom') delete next.dress;
  return next;
}

export function garmentWearable(g: Garment): Wearable | null {
  if (g.status !== 'ready' || !g.tags) return null;
  return { id: g.id, label: TYPE_LABEL[g.tags.type], tags: g.tags, garmentId: g.id, tryOnAllowed: g.tryOnAllowed !== false };
}

/** What the 3D mannequin draws: one look per worn piece that has a 3D form. */
export const looksOf = (picks: Picks): Look[] => Object.values(picks).map((w) => lookFor(w.tags)).filter((l): l is Look => !!l);

/** The Studio camera. */
export function studioCamera(aspect: number) {
  const camera = new THREE.PerspectiveCamera(30, aspect, 0.1, 50);
  // Fit ~2.1 m of height: the tallest body plus room for a hat.
  camera.position.set(0, 1.0, 1.05 / Math.tan(THREE.MathUtils.degToRad(15)) + 0.2);
  camera.lookAt(0, 0.92, 0);
  camera.updateMatrixWorld();
  return camera;
}
