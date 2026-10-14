import { EMBEDDING_DIMENSIONS } from '@stylist/shared';

export function parseVector(value: string | null): number[] | null {
  if (!value) return null;
  const vector: unknown = JSON.parse(value);
  return Array.isArray(vector) &&
    vector.length === EMBEDDING_DIMENSIONS &&
    vector.every((v) => typeof v === 'number' && Number.isFinite(v))
    ? (vector as number[])
    : null;
}
export function tasteVector(
  feedback: { vector: number[]; liked: boolean; at: Date }[],
  now = Date.now(),
) {
  const sum = Array<number>(EMBEDDING_DIMENSIONS).fill(0);
  let total = 0;
  for (const f of feedback) {
    const weight =
      Math.exp(-Math.max(0, now - f.at.getTime()) / (30 * 86400000)) *
      (f.liked ? 1 : -0.25);
    total += Math.abs(weight);
    f.vector.forEach((n, i) => {
      sum[i] += n * weight;
    });
  }
  if (!total) return null;
  const result = sum.map((n) => n / total);
  return result.some((n) => Math.abs(n) > 1e-12) ? result : null;
}
export function formalityRange(occasion: string): [number, number] {
  const text = occasion
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/đ/g, 'd');
  if (/wedding|gala|formal|cuoi|da tiec|le trao/.test(text)) return [4, 5];
  if (/office|work|business|cong so|di lam|phong van/.test(text)) return [2, 4];
  if (/casual|school|weekend|di choi|di hoc|thuong ngay/.test(text))
    return [1, 3];
  return [1, 5];
}
