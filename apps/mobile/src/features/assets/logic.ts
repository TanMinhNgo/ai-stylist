// Pure rules for AI garment assets (no React Native imports, tested in test/assets.test.mjs).
import { GENERATION_MENUS, IdeaRequest, type BodyKey } from '@stylist/shared';

export type MenuId = (typeof GENERATION_MENUS)[number]['id'];
export type GenType = (typeof GENERATION_MENUS)[number]['types'][number];

export const typesFor = (menu: MenuId): readonly GenType[] => GENERATION_MENUS.find((m) => m.id === menu)!.types;
/** Every type an outfit proposal may use (all single-item menus). */
export const ALL_TYPES: readonly GenType[] = GENERATION_MENUS.flatMap((m) => m.types);

/** The body of POST /garment-ideas, or null while the form is incomplete (outfit has no type, others need one from their menu). */
export function ideaRequest(menu: MenuId, type: GenType | null, prompt: string, bodyKey: BodyKey) {
  const parsed = IdeaRequest.safeParse({ menu, prompt, bodyKey, ...(menu === 'outfit' || !type ? {} : { type }) });
  return parsed.success ? parsed.data : null;
}

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

/** Why a batch needing `need` generations cannot be sent, in Vietnamese; null when it can. Never sends a partial batch. */
export function quotaProblem(quota: { enabled: boolean; remaining: number } | undefined, need: number): string | null {
  if (!quota) return 'Đang kiểm tra lượt tạo hình…';
  if (!quota.enabled) return 'Tạo hình cho ma nơ canh đang thử nghiệm và chưa bật cho tài khoản của bạn.';
  if (need > quota.remaining)
    return quota.remaining ? `Cần ${need} lượt nhưng hôm nay chỉ còn ${quota.remaining}. Bỏ bớt món nhé.` : 'Hôm nay bạn đã dùng hết lượt tạo hình. Lượt mới có vào ngày mai.';
  return null;
}

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
