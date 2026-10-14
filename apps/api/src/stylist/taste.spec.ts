import { EMBEDDING_DIMENSIONS } from '@stylist/shared';
import { parseVector, tasteVector, formalityRange } from './taste';
const vector = (x: number, y = 0) => [
  x,
  y,
  ...Array<number>(EMBEDDING_DIMENSIONS - 2).fill(0),
];
it('likes move toward an outfit, dislikes away, and removing feedback clears taste', () => {
  const at = new Date();
  expect(tasteVector([{ vector: vector(1), liked: true, at }])?.[0]).toBe(1);
  expect(tasteVector([{ vector: vector(1), liked: false, at }])?.[0]).toBe(-1);
  const combined = tasteVector([
    { vector: vector(1), liked: true, at },
    { vector: vector(0, 1), liked: false, at },
  ]);
  expect(combined?.[0]).toBeCloseTo(0.8);
  expect(combined?.[1]).toBeCloseTo(-0.2);
  expect(tasteVector([])).toBeNull();
});
it('recent feedback dominates older feedback and zero vectors do not enter cosine ranking', () => {
  const now = Date.now();
  const result = tasteVector(
    [
      { vector: vector(1), liked: true, at: new Date(now) },
      { vector: vector(0, 1), liked: true, at: new Date(now - 60 * 86400000) },
    ],
    now,
  );
  expect(result![0]).toBeGreaterThan(result![1]);
  expect(
    tasteVector([{ vector: vector(0), liked: true, at: new Date() }]),
  ).toBeNull();
  expect(parseVector('[1,2]')).toBeNull();
  expect(parseVector(JSON.stringify(vector(1)))).toHaveLength(1024);
});
it('formality filtering handles Vietnamese accents and unknown occasions', () => {
  expect(formalityRange('Đi học')).toEqual([1, 3]);
  expect(formalityRange('Tiệc cưới')).toEqual([4, 5]);
  expect(formalityRange('Phỏng vấn')).toEqual([2, 4]);
  expect(formalityRange('custom')).toEqual([1, 5]);
});
