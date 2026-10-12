// Turns a tagged garment into instructions for the 3D mannequin. Pure: no React Native or three imports.

type Tags = {
  category: string;
  type: string;
  slot: string;
  colors: string[];
  length: string | null;
  sleeve: string | null;
  fit: string;
};

export type Look =
  | { part: 'top'; color: string; sleeve: 'none' | 'short' | 'three' | 'long'; hem: 'crop' | 'hip'; tuck: boolean; neck: 'crew' | 'v' | 'turtle'; hood: boolean; collar: boolean; ease: number }
  | { part: 'outer'; color: string; sleeve: 'none' | 'long'; coat: boolean; ease: number }
  | { part: 'pants'; color: string; len: 'full' | 'crop' | 'shorts'; wide: number; ease: number }
  | { part: 'skirt'; color: string; hem: 'mini' | 'midi' | 'maxi'; pleats: number }
  | { part: 'dress'; color: string; sleeve: 'none' | 'short' | 'long'; hem: 'mini' | 'midi' | 'maxi' | 'aodai'; jump: 'no' | 'full' | 'shorts'; aodai: boolean }
  | { part: 'shoes'; color: string; style: 'low' | 'sneaker' | 'boot' | 'sandal' }
  | { part: 'bag'; color: string; style: 'tote' | 'crossbody' | 'backpack' | 'clutch' }
  | { part: 'hat'; color: string; style: 'cap' | 'beanie' | 'fedora' }
  | { part: 'eyewear'; color: string; tint: boolean }
  | { part: 'scarf'; color: string }
  | { part: 'belt'; color: string }
  | { part: 'necklace'; color: string }
  | { part: 'earrings'; color: string }
  | { part: 'bracelet'; color: string }
  | { part: 'ring'; color: string }
  | { part: 'tie'; color: string }
  | { part: 'watch'; color: string };

// Colour words the vision model may return, Vietnamese or English. Longer phrases first so
// "xanh navy" wins over "xanh".
const COLORS: [string, string][] = [
  ['xanh navy', '#253858'], ['xanh dương', '#4E7CC2'], ['xanh lá', '#5E8063'], ['xanh rêu', '#4F5D3A'], ['xanh nhạt', '#C9D6E8'], ['xanh ngọc', '#3FA7A0'],
  ['trắng ngà', '#F4F1EA'], ['nâu đậm', '#4A2E1F'], ['vàng kim', '#C9A44C'], ['hồng phấn', '#E7B7C2'], ['đỏ đô', '#7A1F2B'], ['ô liu', '#6B6B3A'],
  ['navy', '#253858'], ['denim', '#3E5A80'], ['olive', '#6B6B3A'], ['burgundy', '#7A1F2B'], ['khaki', '#B8A782'], ['camel', '#B8865B'],
  ['charcoal', '#3A3A40'], ['ivory', '#F4F1EA'], ['cream', '#EDE3D1'], ['beige', '#D9C7AE'], ['white', '#F4F3F0'], ['black', '#1E1E22'],
  ['grey', '#8C8C90'], ['gray', '#8C8C90'], ['brown', '#7A5136'], ['blue', '#4E7CC2'], ['green', '#5E8063'], ['red', '#B3282D'],
  ['pink', '#E7A6B4'], ['purple', '#6E4E8C'], ['yellow', '#E5C35A'], ['orange', '#D9772B'], ['gold', '#C9A44C'], ['silver', '#C0C0C0'],
  ['tan', '#C69C6D'], ['kem', '#EDE3D1'], ['be', '#D9C7AE'], ['trắng', '#F4F3F0'], ['đen', '#1E1E22'], ['xám', '#8C8C90'], ['ghi', '#8C8C90'],
  ['nâu', '#7A5136'], ['xanh', '#4E7CC2'], ['đỏ', '#B3282D'], ['hồng', '#E7A6B4'], ['tím', '#6E4E8C'], ['vàng', '#E5C35A'], ['cam', '#D9772B'], ['bạc', '#C0C0C0'],
];
const FALLBACK = '#9A958E';

export function colorHex(name: string | undefined): string {
  if (!name) return FALLBACK;
  const n = name.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(n)) return n;
  const words = ` ${n} `;
  // Whole-word match so "be" does not hit "beige" or "berry".
  return COLORS.find(([word]) => words.includes(` ${word} `))?.[1] ?? COLORS.find(([word]) => n.includes(word) && word.length > 3)?.[1] ?? FALLBACK;
}

const hemOf = (type: string, length: string | null): 'mini' | 'midi' | 'maxi' =>
  type.startsWith('mini') || length === 'short' || length === 'cropped' ? 'mini' : type.startsWith('maxi') || length === 'maxi' || length === 'long' ? 'maxi' : 'midi';

/** null when the garment has no 3D representation (other_* types the proxy cannot guess). */
export function lookFor(tags: Tags): Look | null {
  const color = colorHex(tags.colors[0]);
  const { type, slot, sleeve, length, fit } = tags;
  switch (slot) {
    case 'top': {
      const s = sleeve === 'sleeveless' || type === 'tank_top' ? 'none' : sleeve === 'short' || type === 't_shirt' || type === 'polo' ? 'short' : sleeve === 'three_quarter' ? 'three' : 'long';
      return {
        part: 'top', color, sleeve: s,
        hem: length === 'cropped' ? 'crop' : 'hip',
        tuck: type === 'shirt' || type === 'blouse',
        neck: type === 'blouse' ? 'v' : 'crew', hood: type === 'hoodie', collar: type === 'shirt' || type === 'polo',
        ease: type === 'hoodie' ? 0.02 : type === 'sweater' ? 0.013 : fit === 'slim' ? 0.005 : 0.008,
      };
    }
    case 'outer':
      return { part: 'outer', color, sleeve: type === 'vest' ? 'none' : 'long', coat: type === 'coat' || type === 'kimono' || length === 'long', ease: type === 'cardigan' ? 0.018 : 0.026 };
    case 'bottom':
      if (tags.category === 'skirt') return { part: 'skirt', color, hem: hemOf(type, length), pleats: 0 };
      return {
        part: 'pants', color,
        len: type === 'shorts' || length === 'short' ? 'shorts' : length === 'cropped' ? 'crop' : 'full',
        wide: type === 'wide_leg' || fit === 'loose' || fit === 'oversized' ? 0.045 : 0,
        ease: type === 'leggings' ? 0.004 : type === 'jeans' ? 0.011 : 0.016,
      };
    case 'dress': {
      const aodai = type === 'ao_dai';
      const jump = type === 'jumpsuit' ? 'full' : type === 'romper' ? 'shorts' : 'no';
      const s = aodai ? 'long' : sleeve === 'sleeveless' ? 'none' : sleeve === 'long' || sleeve === 'three_quarter' ? 'long' : sleeve === 'short' ? 'short' : 'none';
      return { part: 'dress', color, sleeve: s, hem: aodai ? 'aodai' : hemOf(type, length), jump, aodai };
    }
    case 'shoes':
      return { part: 'shoes', color, style: type === 'sneakers' ? 'sneaker' : type === 'boots' ? 'boot' : type === 'sandals' ? 'sandal' : 'low' };
    case 'bag':
      return { part: 'bag', color, style: type === 'crossbody' || type === 'backpack' || type === 'clutch' ? type : 'tote' };
    case 'hat':
      return { part: 'hat', color, style: type === 'cap' || type === 'beanie' ? type : 'fedora' };
    case 'eyewear':
      return { part: 'eyewear', color, tint: type === 'sunglasses' };
    case 'neck':
      return type === 'scarf' ? { part: 'scarf', color } : type === 'tie' ? { part: 'tie', color } : null;
    case 'belt':
      return { part: 'belt', color };
    case 'jewelry':
      return type === 'necklace' || type === 'earrings' || type === 'bracelet' || type === 'ring' ? { part: type, color } : null;
    case 'watch':
      return { part: 'watch', color };
    default:
      return null;
  }
}
