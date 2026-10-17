import type { BodyKey } from '@stylist/shared';
import { create } from 'zustand';

import type { DemoOutfit } from './catalog';
import { pickKey, togglePick, type Picks, type Wearable } from './outfit.ts';

// In-memory on purpose: the outfit being put together survives tab switches, not app restarts.
/** The last try-on started from Studio: lets the user come back to it and re-run it with a new key. */
export type ActiveJob = { id: string; modelPhotoId: string; garmentIds: string[]; occasion: string };

type Studio = {
  body: BodyKey;
  picks: Picks;
  occasion: string;
  activeJob: ActiveJob | null;
  setBody: (body: BodyKey) => void;
  toggle: (w: Wearable) => void;
  wearOutfit: (outfit: DemoOutfit) => void;
  setOccasion: (occasion: string) => void;
  setActiveJob: (job: ActiveJob | null) => void;
  /** "Thử ngay" from a stylist suggestion: its garments replace the picks, body kept. */
  applySuggestion: (picks: Picks, occasion: string) => void;
  /** Back to a blank Studio: picks carry the previous user's private asset URLs and job ids. */
  reset: () => void;
};

const initial = { body: 'f', picks: {}, occasion: 'Đi làm', activeJob: null } satisfies Partial<Studio>;

export const useStudio = create<Studio>()((set) => ({
  ...initial,
  setActiveJob: (activeJob) => set({ activeJob }),
  setBody: (body) => set({ body }),
  toggle: (w) => set(({ picks }) => ({ picks: togglePick(picks, w) })),
  // Formalwear switches to its designed body; casual pieces keep the current body.
  wearOutfit: (o) => set((s) => ({ body: o.bodyKey ?? s.body, picks: Object.fromEntries(o.members.map((w) => [pickKey(w.tags), w])) })),
  setOccasion: (occasion) => set({ occasion }),
  applySuggestion: (picks, occasion) => set({ picks, occasion }),
  reset: () => set(initial),
}));
