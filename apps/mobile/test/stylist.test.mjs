import { test } from 'node:test';
import assert from 'node:assert/strict';

import { OutfitListResponse, StylistJobResponse } from '@stylist/shared';
import { QueryClient } from '@tanstack/react-query';

import { keyFor, pollDelay, pollGaveUp } from '../src/features/assets/logic.ts';
import { removeFromPages } from '../src/features/media/pages.ts';
import { useStudio } from '../src/features/studio/store.ts';
import { adviceWorking, applyFeedback, formatBudget, jobUnsettled, keepKeyAfter, likedParam, needsOnboarding, parseBudget, suggestionPicks, toggleLabel } from '../src/features/stylist/logic.ts';
import { RequestError } from '../src/lib/errors.ts';

const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const outfit = (n, liked = null) => ({
  id: uuid(n), url: 'https://ik.example/o.jpg', thumbnailUrl: 'https://ik.example/t.jpg', occasion: 'Đi làm', garments: [],
  liked, savedAt: '2026-10-14T00:00:00.000Z', createdAt: '2026-10-14T00:00:00.000Z', advice: null, adviceStatus: null, adviceErrorCode: null,
  promptVersion: null, knowledgeVersion: null, isMock: true, adviceIsMock: true,
});
const pages = (...groups) => ({ pages: groups.map((items, i) => ({ items, nextCursor: i < groups.length - 1 ? items.at(-1).id : null })), pageParams: groups.map((_, i) => (i ? groups[i - 1].at(-1).id : undefined)) });
const ids = (data) => data.pages.map((p) => p.items.map((o) => o.id.slice(-1)));

test('list pages parse with the shared schema and keep their cursors', () => {
  const data = pages([outfit(1), outfit(2)], [outfit(3)]);
  for (const page of data.pages) assert.ok(OutfitListResponse.safeParse(page).success);
  assert.equal(data.pages[0].nextCursor, uuid(2));
  assert.equal(data.pages[1].nextCursor, null);
});

test('filters map to liked=true|false, "all" sends nothing', () => {
  assert.equal(likedParam('liked'), 'true');
  assert.equal(likedParam('disliked'), 'false');
  assert.equal(likedParam('all'), undefined);
});

test('optimistic feedback patches "all" and drops outfits that leave a filtered list (liked=false included)', () => {
  const all = pages([outfit(1, true), outfit(2)], [outfit(3, false)]);
  assert.equal(applyFeedback(all, 'all', uuid(2), false).pages[0].items[1].liked, false);
  assert.deepEqual(ids(applyFeedback(all, 'all', uuid(2), false)), [['1', '2'], ['3']]);

  const liked = pages([outfit(1, true), outfit(4, true)]);
  assert.deepEqual(ids(applyFeedback(liked, 'liked', uuid(1), null)), [['4']], 'neutral leaves the liked list');
  assert.equal(applyFeedback(liked, 'liked', uuid(4), true).pages[0].items[1].liked, true);

  const disliked = pages([outfit(3, false), outfit(5, false)]);
  assert.deepEqual(ids(applyFeedback(disliked, 'disliked', uuid(3), true)), [['5']], 'liking leaves the liked=false list');
  assert.deepEqual(ids(applyFeedback(disliked, 'disliked', uuid(5), false)), [['3', '5']]);
  assert.equal(disliked.pages[0].items.length, 2, 'original cache untouched for rollback');
  assert.equal(applyFeedback(undefined, 'all', uuid(1), true), undefined);
});

test('feedback rollback restores every cached list from the snapshot', () => {
  const client = new QueryClient();
  const lists = { queryKey: ['outfits', 'list'] };
  client.setQueryData(['outfits', 'list', 'all'], pages([outfit(1, true)]));
  client.setQueryData(['outfits', 'list', 'liked'], pages([outfit(1, true)]));
  const snapshot = client.getQueriesData({ queryKey: ['outfits'] });
  for (const [key, data] of client.getQueriesData(lists)) client.setQueryData(key, applyFeedback(data, key[2], uuid(1), null));
  assert.deepEqual(ids(client.getQueryData(['outfits', 'list', 'liked'])), [[]]);
  snapshot.forEach(([key, data]) => client.setQueryData(key, data)); // onError
  assert.equal(client.getQueryData(['outfits', 'list', 'liked']).pages[0].items[0].liked, true);
  assert.equal(client.getQueryData(['outfits', 'list', 'all']).pages[0].items[0].liked, true);
});

test('deleting an outfit removes it from every page', () => {
  assert.deepEqual(ids(removeFromPages(pages([outfit(1), outfit(2)], [outfit(3)]), uuid(2))), [['1'], ['3']]);
});

test('onboarding shows only for a never-saved profile that this user has not skipped', () => {
  const profile = { styles: [], occasions: [], budget: null, preferredColors: [], avoidedColors: [], bodyShape: 'pear', skinTone: 'medium', updatedAt: null };
  assert.equal(needsOnboarding(profile, false), true);
  assert.equal(needsOnboarding(profile, true), false, 'skipped');
  assert.equal(needsOnboarding({ ...profile, updatedAt: '2026-10-14T00:00:00.000Z' }, false), false, 'already saved');
  assert.equal(needsOnboarding(undefined, false), false, 'still loading: never blocks');
});

test('budget is integer VND or null, colours stay on one side', () => {
  assert.equal(parseBudget('500.000'), 500000);
  assert.equal(parseBudget(' 1,200,000 đ '), 1200000);
  assert.equal(parseBudget(''), null);
  assert.equal(parseBudget('abc'), undefined);
  assert.equal(parseBudget('2000000000'), undefined);
  assert.equal(formatBudget(1500000), '1.500.000');
  assert.equal(formatBudget(null), '');
  assert.deepEqual(toggleLabel(['đen'], 'trắng', ['trắng', 'đỏ']), [['đen', 'trắng'], ['đỏ']]);
  assert.deepEqual(toggleLabel(['đen'], 'đen'), [[], []]);
  assert.equal(toggleLabel(Array.from({ length: 12 }, (_, i) => `c${i}`), 'x')[0].length, 12, 'max 12');
});

test('idempotency: network/5xx failures keep the key for the same payload, answers and 4xx do not', () => {
  assert.equal(keepKeyAfter(new RequestError('NETWORK_ERROR')), true);
  assert.equal(keepKeyAfter(new RequestError('INTERNAL_ERROR', 503)), true);
  assert.equal(keepKeyAfter(new RequestError('VALIDATION_ERROR', 400)), false);
  assert.equal(keepKeyAfter(new RequestError('IDEMPOTENCY_CONFLICT', 409)), false);
  let n = 0;
  const fresh = () => `k${++n}`;
  const a = keyFor(null, { occasion: 'Tiệc' }, fresh);
  assert.equal(keyFor(a, { occasion: 'Tiệc' }, fresh).key, 'k1', 'resend after a lost response');
  assert.equal(keyFor(a, { occasion: 'Đi làm' }, fresh).key, 'k2', 'changed occasion = new key');
  assert.equal(keyFor(null, { occasion: 'Tiệc' }, fresh).key, 'k3', 'held key cleared after an answer: a new tap is a new job');
});

test('stylist job polling is bounded and stops on ready/failed; advice polls only while queued/processing', () => {
  assert.equal(pollDelay('ready', 0), false);
  assert.equal(pollDelay('failed', 0), false);
  assert.ok(pollDelay('queued', 0) > 0);
  assert.equal(pollGaveUp('processing', 40), true);
  assert.equal(pollGaveUp('ready', 40), false);
  assert.ok(adviceWorking('queued') && adviceWorking('processing'));
  assert.ok(!adviceWorking('ready') && !adviceWorking('failed') && !adviceWorking(null));
  const job = { id: uuid(9), kind: 'suggest', status: 'ready', outfitId: null, errorCode: null, isMock: true, createdAt: '2026-10-14T00:00:00.000Z',
    result: { outfits: [{ garmentIds: [uuid(1)], reason: 'Hợp dịp' }], message: null, occasion: 'Tiệc', isMock: true } };
  assert.ok(StylistJobResponse.safeParse(job).success);
});

test('accepted jobs lock another AI request until terminal, including when GET fails with no status', () => {
  assert.equal(jobUnsettled('job', undefined), true);
  assert.equal(jobUnsettled('job', 'queued'), true);
  assert.equal(jobUnsettled('job', 'processing'), true);
  assert.equal(jobUnsettled('job', 'ready'), false);
  assert.equal(jobUnsettled('job', 'failed'), false);
  assert.equal(jobUnsettled(null, undefined), false);
});

const garment = (n, slot, extra = {}) => ({
  id: uuid(n), status: 'ready', tryOnAllowed: true, thumbnailUrl: 'https://ik.example/g.jpg', mannequinAsset: null,
  tags: { category: slot === 'bottom' ? 'bottom' : 'top', type: slot === 'bottom' ? 'jeans' : 'shirt', slot, colors: ['trắng'], length: null, sleeve: null, fit: 'regular' },
  ...extra,
});

test('"Thử ngay" replaces picks, clears the preset, keeps the body and sets the suggested occasion', () => {
  const picked = suggestionPicks([garment(1, 'top'), garment(2, 'bottom')]);
  assert.deepEqual(Object.keys(picked.picks).sort(), ['bottom', 'top']);
  assert.ok(Object.values(picked.picks).every((w) => w.garmentId && w.tryOnAllowed));

  useStudio.getState().reset();
  useStudio.getState().setBody('m');
  useStudio.getState().wearOutfit({ id: 'formal', label: 'F', bodyKey: 'm', image: 1, preset: { id: 'formal', sprite: {}, size: 1 }, members: [{ id: 'demo:x', label: 'x', tags: garment(9, 'top').tags, garmentId: null, tryOnAllowed: false, sprite: null, preset: 'formal' }] });
  useStudio.getState().applySuggestion(picked.picks, 'Tiệc cưới');
  const s = useStudio.getState();
  assert.equal(s.body, 'm');
  assert.equal(s.preset, null);
  assert.equal(s.occasion, 'Tiệc cưới');
  assert.deepEqual(Object.values(s.picks).map((w) => w.garmentId).sort(), [uuid(1), uuid(2)]);
  useStudio.getState().reset();
});

test('"Thử ngay" applies nothing when a piece is deleted, pending or not allowed', () => {
  for (const bad of [null, garment(3, 'top', { status: 'pending', tags: null }), garment(4, 'top', { tryOnAllowed: false })]) {
    const r = suggestionPicks([garment(1, 'bottom'), bad]);
    assert.ok('problem' in r && /gợi ý mới/.test(r.problem));
  }
  assert.ok('problem' in suggestionPicks([]));
});
