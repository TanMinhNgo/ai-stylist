// Pure rules for adding garments and polling jobs (no React Native imports, tested in test/assets.test.mjs).
import { GENERATION_MENUS } from '@stylist/shared';

export type MenuId = (typeof GENERATION_MENUS)[number]['id'];
export type GenType = (typeof GENERATION_MENUS)[number]['types'][number];

export const typesFor = (menu: MenuId): readonly GenType[] => GENERATION_MENUS.find((m) => m.id === menu)!.types;

/** Give up polling a job after this many fetches (~6 minutes with the backoff below). */
export const MAX_ASSET_POLLS = 40;

/** A job that ended (ready/failed): polling stops, and making another one needs a fresh Idempotency-Key. */
export const done = (status: string | undefined) => status === 'ready' || status === 'failed';

export function pollDelay(status: string | undefined, fetches: number): number | false {
  if (done(status) || fetches >= MAX_ASSET_POLLS) return false;
  return Math.min(2000 * 1.3 ** fetches, 10_000);
}

/** Polling stopped before the job finished: the UI offers a manual "Kiểm tra lại" instead of polling forever. */
export const pollGaveUp = (status: string | undefined, fetches: number) => !done(status) && pollDelay(status, fetches) === false;

export type HeldKey = { key: string; payload: string };

/** Same payload keeps its Idempotency-Key (retry after a lost response); a changed payload gets a new one. */
export function keyFor(prev: HeldKey | null, payload: unknown, fresh: () => string): HeldKey {
  const p = JSON.stringify(payload);
  return prev && prev.payload === p ? prev : { key: fresh(), payload: p };
}

export type CropRect = { x: number; y: number; width: number; height: number };
export const MIN_CROP = 64;

/** Keep the crop inside the image and at least MIN_CROP px on each side, in whole pixels. */
export function clampCrop(r: CropRect, image: { width: number; height: number }): CropRect {
  const width = Math.round(Math.min(Math.max(r.width, MIN_CROP), image.width));
  const height = Math.round(Math.min(Math.max(r.height, MIN_CROP), image.height));
  const x = Math.round(Math.min(Math.max(r.x, 0), image.width - width));
  const y = Math.round(Math.min(Math.max(r.y, 0), image.height - height));
  return { x, y, width, height };
}

export const cropValid = (r: CropRect, image: { width: number; height: number }) =>
  r.x >= 0 && r.y >= 0 && r.width >= MIN_CROP && r.height >= MIN_CROP && r.x + r.width <= image.width && r.y + r.height <= image.height;
