import type { ReactNode } from 'react';
import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';

import type { Look } from '@/features/studio/looks';

const INK = '#1d1b22';

/** Flat cartoon icon of a garment, drawn from its look (shape + colour) like the anime mannequin. */
export function GarmentIcon({ look, size = 56 }: { look: Look | null; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" stroke={INK} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round">
      {look ? shape(look) : <Path d="M32 18 a5 5 0 1 1 5 -5 M32 18 L32 22 L6 44 L58 44 Z" fill="none" />}
    </Svg>
  );
}

// Right sleeve outline from the shoulder down and back to the armpit; the left one is its mirror.
const SLEEVES: Record<'short' | 'three' | 'long', number[][]> = {
  short: [[50, 15], [56, 26], [48, 30], [45, 26]],
  three: [[50, 14], [56, 38], [48, 40], [45, 28]],
  long: [[50, 14], [56, 48], [48, 50], [45, 28]],
};

/** Shirt-like body with sleeves and hem height. */
function body(color: string, sleeve: 'none' | keyof typeof SLEEVES, hem: number): ReactNode {
  if (sleeve === 'none') return <Path d={`M25 10 Q32 16 39 10 L44 16 L44 ${hem} L20 ${hem} L20 16 Z`} fill={color} />;
  const right = SLEEVES[sleeve], leftSide = right.map(([x, y]) => [64 - x, y]).reverse();
  const pts = (p: number[][]) => p.map(([x, y]) => `L${x} ${y}`).join(' ');
  return <Path d={`M24 10 Q32 16 40 10 ${pts(right)} L45 ${hem} L19 ${hem} ${pts(leftSide)} Z`} fill={color} />;
}

function shape(l: Look): ReactNode {
  const c = l.color;
  switch (l.part) {
    case 'top':
      return (
        <>
          {l.hood ? <Path d="M21 14 Q20 2 32 2 Q44 2 43 14 Z" fill={c} /> : null}
          {body(c, l.sleeve, l.hem === 'crop' ? 40 : 56)}
          {l.collar ? <Path d="M24 10 L31 19 L26 21 Z M40 10 L33 19 L38 21 Z" fill={c} /> : null}
          {l.neck === 'v' ? <Path d="M26 11 L32 19 L38 11" fill="none" /> : null}
        </>
      );
    case 'outer':
      return (
        <>
          {body(c, l.sleeve === 'none' ? 'none' : 'long', l.coat ? 62 : 54)}
          <Path d={`M32 18 L32 ${l.coat ? 62 : 54} M25 11 L31 28 M39 11 L33 28`} fill="none" />
        </>
      );
    case 'pants': {
      const w = l.wide ? 4 : 0;
      const hem = l.len === 'shorts' ? 30 : l.len === 'crop' ? 48 : 60;
      const crotch = l.len === 'shorts' ? 18 : 22;
      return <Path d={`M18 6 L46 6 L${48 + w} ${hem} L${36 - w / 2} ${hem} L32 ${crotch} L${28 + w / 2} ${hem} L${16 - w} ${hem} Z M18 11 L46 11`} fill={c} />;
    }
    case 'skirt': {
      const hem = { mini: 34, midi: 46, maxi: 60 }[l.hem], flare = { mini: 6, midi: 9, maxi: 12 }[l.hem];
      return <Path d={`M22 8 L42 8 L${42 + flare} ${hem} L${22 - flare} ${hem} Z M22 13 L42 13`} fill={c} />;
    }
    case 'dress': {
      const hem = { mini: 40, midi: 50, maxi: 60, aodai: 62 }[l.hem];
      const flare = l.aodai ? 2 : { mini: 8, midi: 11, maxi: 14, aodai: 2 }[l.hem];
      const legs = l.jump === 'full' ? 'L44 60 L35 60 L32 34 L29 60 L20 60' : l.jump === 'shorts' ? 'L44 40 L34 40 L32 34 L30 40 L20 40' : `L${41 + flare} ${hem} L${23 - flare} ${hem}`;
      const sleeves = l.sleeve === 'long' ? 'M25 6 L18 10 L12 36 L18 38 L23 18 M39 6 L46 10 L52 36 L46 38 L41 18' : l.sleeve === 'short' ? 'M25 6 L18 10 L15 20 L22 22 M39 6 L46 10 L49 20 L42 22' : '';
      return (
        <>
          {sleeves ? <Path d={sleeves} fill={c} /> : null}
          <Path d={`M25 6 Q32 11 39 6 L41 24 ${legs} L23 24 Z`} fill={c} />
          {l.aodai ? <Path d="M25 6 Q32 4 39 6" fill="none" /> : null}
        </>
      );
    }
    case 'shoes':
      switch (l.style) {
        case 'boot':
          return <Path d="M14 10 L30 10 L30 34 Q48 36 54 42 L54 50 L14 50 Z M14 44 L54 44" fill={c} />;
        case 'sandal':
          return (
            <>
              <Path d="M8 46 Q32 41 58 46 L58 50 L8 50 Z" fill={c} />
              <Path d="M16 45 Q24 30 34 44 M38 43 Q44 34 50 44" fill="none" stroke={c} strokeWidth={4} />
            </>
          );
        case 'sneaker':
          return <Path d="M8 42 L8 30 Q20 30 26 24 L34 24 Q40 34 56 36 Q60 38 58 42 Z M8 42 L58 42 L58 48 L8 48 Z M28 30 L32 34 M32 28 L36 32" fill={c} />;
        default:
          return <Path d="M8 46 L10 36 Q24 36 30 31 Q46 34 56 40 L56 46 Z" fill={c} />;
      }
    case 'bag':
      switch (l.style) {
        case 'backpack':
          return <Path d="M26 14 Q26 6 32 6 Q38 6 38 14 M16 22 Q16 14 24 14 L40 14 Q48 14 48 22 L48 58 L16 58 Z M16 30 L48 30 M24 40 L40 40 L40 50 L24 50 Z" fill={c} />;
        case 'clutch':
          return <Path d="M8 24 L56 24 L56 46 L8 46 Z M8 24 L32 36 L56 24" fill={c} />;
        case 'crossbody':
          return (
            <>
              <Path d="M18 34 L30 4 M46 34 L34 4" fill="none" />
              <Rect x={14} y={30} width={36} height={24} rx={6} fill={c} />
            </>
          );
        default:
          return (
            <>
              <Path d="M22 26 Q22 10 32 10 Q42 10 42 26" fill="none" />
              <Path d="M14 26 L50 26 L46 56 L18 56 Z" fill={c} />
            </>
          );
      }
    case 'hat':
      switch (l.style) {
        case 'cap':
          return <Path d="M10 38 Q10 14 30 14 Q48 14 48 38 Z M44 38 Q60 36 60 42 L40 42 Z" fill={c} />;
        case 'beanie':
          return (
            <>
              <Circle cx={32} cy={10} r={5} fill={c} />
              <Path d="M14 42 Q14 14 32 14 Q50 14 50 42 Z" fill={c} />
              <Rect x={12} y={38} width={40} height={10} rx={3} fill={c} />
            </>
          );
        default:
          return (
            <>
              <Ellipse cx={32} cy={42} rx={27} ry={7} fill={c} />
              <Path d="M20 42 L22 18 Q32 13 42 18 L44 42 Z" fill={c} />
              <Path d="M21 34 L43 34" fill="none" strokeWidth={4} />
            </>
          );
      }
    case 'eyewear': {
      const lens = l.tint ? '#2A2A33' : '#FFFFFF';
      return (
        <>
          <Path d="M28 32 Q32 28 36 32 M6 28 L10 30 M58 28 L54 30" fill="none" stroke={c} strokeWidth={4} />
          <Circle cx={19} cy={33} r={10} fill={lens} stroke={c} strokeWidth={4} />
          <Circle cx={45} cy={33} r={10} fill={lens} stroke={c} strokeWidth={4} />
        </>
      );
    }
    case 'scarf':
      return <Path d="M16 12 Q32 26 48 12 L50 22 Q32 36 14 22 Z M36 28 L44 58 L35 60 L30 30 Z" fill={c} />;
    case 'belt':
      return (
        <>
          <Rect x={4} y={26} width={56} height={12} rx={2} fill={c} />
          <Rect x={24} y={22} width={14} height={20} rx={2} fill="none" stroke="#C9A44C" strokeWidth={4} />
        </>
      );
    case 'necklace':
      return (
        <>
          <Path d="M14 10 Q32 46 50 10" fill="none" stroke={c} strokeWidth={3} />
          <Circle cx={32} cy={40} r={5} fill={c} />
        </>
      );
    case 'earrings':
      return (
        <>
          <Path d="M20 12 Q16 16 20 22 M44 12 Q40 16 44 22" fill="none" stroke={c} strokeWidth={3} />
          <Circle cx={20} cy={30} r={7} fill={c} />
          <Circle cx={44} cy={30} r={7} fill={c} />
        </>
      );
    case 'bracelet':
      return <Ellipse cx={32} cy={32} rx={22} ry={14} fill="none" stroke={c} strokeWidth={7} />;
    case 'ring':
      return (
        <>
          <Circle cx={32} cy={38} r={14} fill="none" stroke={c} strokeWidth={5} />
          <Path d="M26 22 L32 14 L38 22 L32 26 Z" fill="#BFE6F2" />
        </>
      );
    case 'tie':
      return <Path d="M27 6 L37 6 L35 15 L29 15 Z M29 15 L35 15 L41 50 L32 59 L23 50 Z" fill={c} />;
    case 'watch':
      return (
        <>
          <Rect x={25} y={4} width={14} height={56} rx={4} fill={c} />
          <Circle cx={32} cy={32} r={12} fill="#FFFFFF" stroke={c} strokeWidth={4} />
          <Path d="M32 26 L32 32 L36 34" fill="none" strokeWidth={2} />
        </>
      );
  }
}
