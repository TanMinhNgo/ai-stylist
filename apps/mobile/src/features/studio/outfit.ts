// What the mannequin wears and how each piece is drawn. Pure (three only), tested in test/outfit.test.mjs.
import type { BodyKey, Garment } from '@stylist/shared';
import * as THREE from 'three';

import { TYPE_LABEL } from '../garments/labels.ts';
import { lookFor, type Look } from './looks.ts';

type Tags = Parameters<typeof lookFor>[0];
type Lm = Record<string, number>;

/** A front-view PNG: never a texture, only a 2D layer laid over the bare mannequin when it faces the camera. */
export type Sprite = { source: number | { uri: string }; width: number; height: number; bounds: readonly [number, number, number, number]; bodyKeys: readonly BodyKey[] };

/** Anything the mannequin can wear: a real Garment (garmentId set) or a bundled demo piece (garmentId null, never sent to the API). */
export type Wearable = { id: string; label: string; tags: Tags; garmentId: string | null; tryOnAllowed: boolean; sprite: Sprite | null; preset?: string; thumb?: string };
export type Picks = Record<string, Wearable>;
/** A demo outfit drawn as one PNG; only used while every member is still picked. */
export type Preset = { id: string; sprite: Sprite; size: number };
export type DemoOutfit = { id: string; label: string; bodyKey: BodyKey | null; image: number | null; preset: Preset | null; members: Wearable[] };

/** Separate pieces, so casual outfits keep the current body and use ordinary PNG layers. */
export function casualOutfits(definitions: { id: string; label: string; itemIds: string[] }[], items: Wearable[]): DemoOutfit[] {
  return definitions.map((o) => ({
    id: o.id, label: o.label, bodyKey: null, image: null, preset: null,
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
  const a = g.mannequinAsset;
  return {
    id: g.id, label: TYPE_LABEL[g.tags.type], tags: g.tags, garmentId: g.id, tryOnAllowed: g.tryOnAllowed !== false, thumb: g.thumbnailUrl,
    sprite: a ? { source: { uri: a.url }, width: a.width, height: a.height, bounds: a.bounds, bodyKeys: [a.bodyKey] } : null,
  };
}

// Back to front. Tops sit over trousers (tucked shirts still read fine in 2D), outerwear over tops.
const ORDER = ['preset', 'shoes', 'bottom', 'dress', 'top', 'belt', 'outer', 'neck', 'jewelry', 'watch', 'bag', 'eyewear', 'hat'];

export type Layer = { key: string; slot: string; type: string; sprite: Sprite };
export type StagePlan = { looks: Look[]; sprites: Layer[]; mismatched: Wearable[] };

/**
 * front: pieces with a PNG for this body become sprites and are left off the 3D body (no proxy drawn under them);
 * orbit: everything is a 3D proxy. A PNG made for the other body is never used: proxy + listed in `mismatched`.
 */
export function stagePlan(picks: Picks, preset: Preset | null, body: BodyKey, view: 'front' | 'orbit'): StagePlan {
  const entries = Object.entries(picks);
  const presetOn = !!preset && view === 'front' && preset.sprite.bodyKeys.includes(body) && entries.filter(([, w]) => w.preset === preset.id).length === preset.size;
  const plan: StagePlan = { looks: [], sprites: [], mismatched: [] };
  if (presetOn) plan.sprites.push({ key: `preset:${preset.id}`, slot: 'preset', type: 'preset', sprite: preset.sprite });
  for (const [key, w] of entries) {
    if (presetOn && w.preset === preset.id) continue;
    const fits = !!w.sprite && w.sprite.bodyKeys.includes(body);
    if (w.sprite && !fits) plan.mismatched.push(w);
    if (view === 'front' && fits) plan.sprites.push({ key, slot: w.tags.slot, type: w.tags.type, sprite: w.sprite! });
    else {
      const look = lookFor(w.tags);
      if (look) plan.looks.push(look);
    }
  }
  plan.sprites.sort((a, b) => ORDER.indexOf(a.slot) - ORDER.indexOf(b.slot));
  return plan;
}

/** The Studio camera; Mannequin3D renders with it and sprites are placed by projecting through it. */
export function studioCamera(aspect: number) {
  const camera = new THREE.PerspectiveCamera(30, aspect, 0.1, 50);
  // Fit ~2.1 m of height: the tallest body plus room for a hat.
  camera.position.set(0, 1.0, 1.05 / Math.tan(THREE.MathUtils.degToRad(15)) + 0.2);
  camera.lookAt(0, 0.92, 0);
  camera.updateMatrixWorld();
  return camera;
}

type Box = [x0: number, x1: number, top: number, bottom: number, align: 'top' | 'center' | 'bottom'];
// Where each slot's PNG goes, in metres on the body (landmarks from mannequin.json, front plane z=0).
// ponytail: hand-tuned boxes per slot, alphaBounds are not landmarks; calibrate on device and per asset if a piece looks off.
const BOX: Record<string, (l: Lm) => Box> = {
  preset: (l) => [-(l.wristX + 0.05), l.wristX + 0.05, l.collar + 0.05, -0.01, 'bottom'],
  top: (l) => [-(l.wristX + 0.03), l.wristX + 0.03, l.collar + 0.035, l.crotch - 0.03, 'top'],
  outer: (l) => [-(l.wristX + 0.045), l.wristX + 0.045, l.collar + 0.05, l.crotch - 0.06, 'top'],
  dress: (l) => [-(l.wristX + 0.03), l.wristX + 0.03, l.collar + 0.035, l.ankle + 0.02, 'top'],
  bottom: (l) => [-l.legX * 2.6, l.legX * 2.6, l.waist + 0.02, 0, 'top'],
  shoes: (l) => [-(l.legX + 0.09), l.legX + 0.09, l.ankle + 0.12, -0.005, 'bottom'],
  bag: (l) => [-l.shoulderX * 0.6, l.handX + 0.08, l.collar, l.hipY - 0.12, 'top'],
  hat: (l) => [-(l.headRx + 0.09), l.headRx + 0.09, l.headY + l.headRy + 0.09, l.headY + l.headRy * 0.25, 'bottom'],
  eyewear: (l) => [-(l.headRx + 0.012), l.headRx + 0.012, l.headY + 0.03, l.headY - 0.03, 'center'],
  neck: (l) => [-0.13, 0.13, l.collar + 0.04, l.bustY - 0.16, 'top'],
  belt: (l) => [-l.legX * 2.3, l.legX * 2.3, l.waist + 0.05, l.waist - 0.08, 'center'],
  watch: (l) => [-l.wristX - 0.045, -l.wristX + 0.045, l.wrist + 0.03, l.wrist - 0.03, 'center'],
  'jewelry:necklace': (l) => [-0.11, 0.11, l.collar + 0.025, l.bustY - 0.06, 'top'],
  'jewelry:earrings': (l) => [-(l.headRx + 0.01), l.headRx + 0.01, l.headY - 0.01, l.headY - l.headRy - 0.08, 'top'],
  'jewelry:bracelet': (l) => [l.wristX - 0.045, l.wristX + 0.045, l.wrist + 0.03, l.wrist - 0.03, 'center'],
  'jewelry:ring': (l) => [l.handX - 0.02, l.handX + 0.025, l.handY - 0.02, l.handY - 0.07, 'center'],
};

export type Rect = { left: number; top: number; width: number; height: number };

/** Screen rect (view pixels) for the whole PNG so its alpha bounds fit the slot box, aspect kept. */
export function spriteRect(layer: Layer, lm: Lm, view: { width: number; height: number }, camera = studioCamera(view.width / view.height)): Rect {
  const box = (BOX[layer.slot === 'jewelry' ? `jewelry:${layer.type}` : layer.slot] ?? BOX.top)(lm);
  const toScreen = (x: number, y: number) => {
    const p = new THREE.Vector3(x, y, 0).project(camera);
    return [((p.x + 1) / 2) * view.width, ((1 - p.y) / 2) * view.height];
  };
  // The camera looks slightly down, so measure both horizontal edges at the same height or the box skews.
  const midY = (box[2] + box[3]) / 2;
  const [x0] = toScreen(box[0], midY), [x1] = toScreen(box[1], midY);
  const [, y0] = toScreen(0, box[2]), [, y1] = toScreen(0, box[3]);
  const [bl, bt, bw, bh] = layer.sprite.bounds;
  const scale = Math.min((x1 - x0) / bw, (y1 - y0) / bh);
  const left = (x0 + x1) / 2 - (bw * scale) / 2;
  const top = box[4] === 'top' ? y0 : box[4] === 'bottom' ? y1 - bh * scale : (y0 + y1) / 2 - (bh * scale) / 2;
  return { left: left - bl * scale, top: top - bt * scale, width: layer.sprite.width * scale, height: layer.sprite.height * scale };
}
