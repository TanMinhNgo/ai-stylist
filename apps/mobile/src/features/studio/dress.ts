// Dresses the procedural mannequin. Only depends on three, so node can test it (test/dress.test.mjs).
import * as THREE from 'three';

import type { Look } from './looks';
import type { Body } from './scene';

export const R = { head: 0, torso: 1, upper: 2, fore: 3, hand: 4, pelvis: 5, thigh: 6, calf: 7, foot: 8, eye: 10, iris: 11 } as const;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/** Short hair as 0..1 per vertex around the head centre; soft edges give a natural hairline instead of mesh steps. */
function hairMask(m: Body) {
  const { lm, pos, reg } = m;
  const cy = lm.hairTop - 0.11, cz = lm.faceFront - 0.1;
  const mask = new Float32Array(m.n);
  for (let i = 0; i < m.n; i++) {
    if (reg[i] !== R.head || pos[i * 3 + 1] < lm.neck) continue;
    const ax = Math.abs(pos[i * 3]), dy = pos[i * 3 + 1] - cy, dz = pos[i * 3 + 2] - cz;
    const crown = smooth(0.022, 0.045, dy);
    const back = smooth(-0.004, -0.026, dz) * smooth(lm.nape - 0.018, lm.nape + 0.004, dy);
    const side = smooth(0.046, 0.06, ax) * smooth(0.012, -0.01, dz) * smooth(0.0, 0.022, dy);
    mask[i] = Math.max(crown, back, side);
  }
  return mask;
}

function hairGeo(m: Body) {
  const mask = hairMask(m);
  const pos = new Float32Array(m.n * 3), col = new Float32Array(m.n * 4).fill(1);
  for (let i = 0; i < m.n; i++) {
    const e = 0.0015 + 0.007 * mask[i];
    for (let k = 0; k < 3; k++) pos[i * 3 + k] = m.pos[i * 3 + k] + m.nrm[i * 3 + k] * e;
    col[i * 4 + 3] = mask[i];
  }
  const index: number[] = [];
  for (let t = 0; t < m.idx.length; t += 3) if (mask[m.idx[t]] + mask[m.idx[t + 1]] + mask[m.idx[t + 2]] > 0.02) index.push(m.idx[t], m.idx[t + 1], m.idx[t + 2]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 4));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}

/** Triangles whose 3 vertices pass keep(i), pushed out along the body normal by ease (metres or per vertex). */
function part(m: Body, keep: (i: number) => boolean, ease: number | ((i: number) => number)) {
  const out: number[] = [];
  for (let t = 0; t < m.idx.length; t += 3) if (keep(m.idx[t]) && keep(m.idx[t + 1]) && keep(m.idx[t + 2])) out.push(m.idx[t], m.idx[t + 1], m.idx[t + 2]);
  let pos = m.pos;
  if (ease) {
    pos = new Float32Array(m.pos.length);
    for (let i = 0; i < m.n; i++) {
      const e = typeof ease === 'function' ? ease(i) : ease;
      for (let k = 0; k < 3; k++) pos[i * 3 + k] = m.pos[i * 3 + k] + m.nrm[i * 3 + k] * e;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(out);
  g.computeVertexNormals();
  return g;
}

/** Tube hanging from the body envelope: skirts, coat tails, áo dài panels. */
function skirtGeo(m: Body, o: { top: number; hem: number; ease: number; flare: number; pleats?: number; front?: number; slits?: number }) {
  const env = m.skirt.filter((s) => s[0] <= m.lm.waist);
  const S = 96, rows = 28, verts: number[] = [], index: number[] = [];
  const at = (y: number) => {
    let a = env[0], b = env[env.length - 1];
    for (let i = 0; i < env.length - 1; i++) if (env[i][0] <= y && env[i + 1][0] >= y) { a = env[i]; b = env[i + 1]; }
    const t = b[0] === a[0] ? 0 : clamp01((y - a[0]) / (b[0] - a[0]));
    return [a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, a[3] + (b[3] - a[3]) * t];
  };
  let widest = [0, 0, 0];
  for (let r = 0; r <= rows; r++) {
    const f = r / rows, y = o.top - (o.top - o.hem) * f, e = at(y), flare = o.flare * f;
    widest = [Math.max(widest[0], e[0]), Math.max(widest[1], e[1]), Math.max(widest[2], e[2])];
    for (let s = 0; s <= S; s++) {
      const a = (s / S) * Math.PI * 2, sx = Math.sin(a), cz = Math.cos(a);
      const pleat = o.pleats ? 1 + 0.06 * f * Math.abs(Math.sin(a * o.pleats)) : 1;
      verts.push(sx * (widest[0] + o.ease + flare) * pleat, y, cz * ((cz > 0 ? widest[1] : widest[2]) + o.ease + flare) * pleat);
    }
  }
  const skip = (a: number) =>
    (!!o.front && (a < o.front || a > Math.PI * 2 - o.front)) || (!!o.slits && (Math.abs(a - Math.PI / 2) < o.slits || Math.abs(a - Math.PI * 1.5) < o.slits));
  for (let r = 0; r < rows; r++)
    for (let s = 0; s < S; s++) {
      if (skip(((s + 0.5) / S) * Math.PI * 2)) continue;
      const i0 = r * (S + 1) + s, i1 = i0 + S + 1;
      index.push(i0, i1, i0 + 1, i1, i1 + 1, i0 + 1);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}

function depthAt(m: Body, y: number, back = false) {
  let best = 0;
  for (let i = 0; i < m.n; i++) {
    const g = m.reg[i];
    if ((g === R.torso || g === R.pelvis || g === R.head) && Math.abs(m.pos[i * 3 + 1] - y) < 0.012) {
      const z = m.pos[i * 3 + 2];
      if (back ? z < best : z > best) best = z;
    }
  }
  return best;
}

function halfWidthAt(m: Body, y: number) {
  let w = 0;
  for (let i = 0; i < m.n; i++) {
    const g = m.reg[i];
    if ((g === R.pelvis || g === R.thigh || g === R.torso) && Math.abs(m.pos[i * 3 + 1] - y) < 0.012) w = Math.max(w, Math.abs(m.pos[i * 3]));
  }
  return w;
}

/** Soft round contact shadow (cheaper and more robust on phones than shadow maps). */
export function contactShadow() {
  const size = 64, data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - size / 2, y - size / 2) / (size / 2);
      data[(y * size + x) * 4 + 3] = Math.round(Math.pow(clamp01(1 - d), 2) * 110);
    }
  const tex = new THREE.DataTexture(data, size, size);
  tex.needsUpdate = true;
  const mesh = new THREE.Mesh(new THREE.CircleGeometry(0.55, 48), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.001;
  return mesh;
}

/** Rebuilds `fig` as the body wearing `looks`. Previous children are disposed except the shared skin material. */
export function dress(fig: THREE.Group, m: Body, looks: Look[], skin: THREE.Material, hidden: number[] = []) {
  for (const o of [...fig.children] as THREE.Mesh[]) {
    fig.remove(o);
    o.geometry.dispose();
    if (o.material !== skin) (o.material as THREE.Material).dispose();
  }
  const { reg, pos, lm, H } = m;
  const s = lm.knee / 0.5;
  const Y = (i: number) => pos[i * 3 + 1], X = (i: number) => pos[i * 3], Z = (i: number) => pos[i * 3 + 2];
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0) => {
    const o = new THREE.Mesh(geo, mat);
    o.position.set(x, y, z);
    fig.add(o);
    return o;
  };
  // Same fabric as the design: physical sheen gives cloth its soft rim instead of a plastic look.
  const cloth = (color: string, roughness = 0.8) => new THREE.MeshPhysicalMaterial({ color, roughness, sheen: 0.8, sheenRoughness: 0.7, sheenColor: new THREE.Color(0.35, 0.35, 0.35), side: THREE.DoubleSide });
  const metal = (color: string) => new THREE.MeshStandardMaterial({ color, metalness: 0.9, roughness: 0.3 });
  const tube = (pts: number[][], r: number, mat: THREE.Material) =>
    add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(p[0], p[1], p[2]))), 64, r, 8, false), mat);
  const get = <P extends Look['part']>(p: P) => looks.find((l) => l.part === p) as Extract<Look, { part: P }> | undefined;

  // MakeHuman body (scripts/mannequin/human.py). Regions under a front PNG are left out (see outfit.ts covers).
  add(part(m, (i) => reg[i] < R.eye && !hidden.includes(reg[i]), 0), skin);
  add(hairGeo(m), new THREE.MeshPhysicalMaterial({ color: '#1F1A17', roughness: 0.55, sheen: 0.6, sheenRoughness: 0.4, sheenColor: new THREE.Color('#5a4a40'), vertexColors: true, transparent: true }));
  add(part(m, (i) => reg[i] === R.eye, 0), new THREE.MeshStandardMaterial({ color: '#F2EEE8', roughness: 0.2 }));
  add(part(m, (i) => reg[i] === R.iris, 0), new THREE.MeshStandardMaterial({ color: '#2A1D16', roughness: 0.15 }));
  add(new THREE.CylinderGeometry(0.21, 0.22, 0.012, 64), new THREE.MeshStandardMaterial({ color: '#2A2A2E', roughness: 0.35, metalness: 0.4 }), 0, -0.006, 0);

  const skirtHem = { mini: lm.crotch - 0.07 * H, midi: lm.knee - 0.05 * H, maxi: lm.ankle + 0.035 * H, aodai: lm.ankle + 0.1 * H, knee: lm.knee - 0.02 * H };
  const skirtFlare = { mini: 0.02, midi: 0.05, maxi: 0.08, aodai: 0.03, knee: 0.05 };
  let lowerEase = 0;

  type ShellSpec = { color: string; sleeve: 'none' | 'short' | 'three' | 'long'; neck?: 'crew' | 'v' | 'scoop' | 'turtle' | 'mandarin'; open?: number; rough?: number };
  const shell = (g: ShellSpec, ease: number | ((i: number) => number), hem: number) => {
    const collar = lm.collar, shortCut = lm.armpit - 0.07 * H, threeCut = lm.wrist + 0.09 * H, wristCut = lm.wrist + 0.01 * H;
    const neckTop = Math.min(collar + (g.neck === 'turtle' ? 0.045 : 0.025) * H, lm.headY - lm.headRy * 0.75);
    const keep = (i: number) => {
      const r = reg[i], y = Y(i), x = X(i), z = Z(i);
      if (r === R.torso || r === R.pelvis) {
        if (y < hem) return false;
        if (z > 0 && g.neck === 'v' && y > collar - 0.13 * H + 1.6 * Math.abs(x)) return false;
        if (z > 0 && g.neck === 'scoop' && y > collar - 0.06 * H && Math.abs(x) < 0.09) return false;
        if (g.open && z > 0 && Math.abs(x) < 0.012 + (y > lm.waist ? g.open * clamp01((y - lm.waist) / (collar - lm.waist)) : 0)) return false;
        return true;
      }
      if (r === R.upper) return g.sleeve !== 'none' && (g.sleeve !== 'short' || y >= shortCut);
      if (r === R.fore) return (g.sleeve === 'long' && y >= wristCut) || (g.sleeve === 'three' && y >= threeCut);
      if (r === R.head) return (g.neck === 'turtle' || g.neck === 'mandarin') && y < neckTop;
      return false;
    };
    return add(part(m, keep, ease), cloth(g.color, g.rough));
  };
  const pants = (color: string, len: 'full' | 'crop' | 'shorts', wide: number, ease: number) => {
    const cut = len === 'shorts' ? lm.knee + 0.13 * H : len === 'crop' ? lm.ankle + 0.07 * H : lm.ankle + 0.012 * H;
    const geo = part(m, (i) => (reg[i] === R.pelvis ? Y(i) <= lm.waist - 0.005 * H : (reg[i] === R.thigh || reg[i] === R.calf) && Y(i) >= cut), ease);
    if (wide) {
      const p = geo.getAttribute('position').array as Float32Array, top = lm.knee + 0.15 * H;
      for (let i = 0; i < m.n; i++) {
        if ((reg[i] === R.thigh || reg[i] === R.calf) && p[i * 3 + 1] < top) {
          const cx = (p[i * 3] < 0 ? -1 : 1) * lm.legX, dx = p[i * 3] - cx, dz = p[i * 3 + 2], l = Math.hypot(dx, dz) || 1;
          const push = wide * clamp01((top - p[i * 3 + 1]) / (top - lm.ankle));
          p[i * 3] += (dx / l) * push;
          p[i * 3 + 2] += (dz / l) * push;
        }
      }
      geo.computeVertexNormals();
    }
    return add(geo, cloth(color));
  };

  const dressLook = get('dress'), top = get('top'), outer = get('outer');
  const bottom = (get('pants') ?? get('skirt')) as Extract<Look, { part: 'pants' | 'skirt' }> | undefined;
  // Neutral base layer so the realistic body is never shown bare where nothing is worn.
  const base = cloth('#B7B1AA', 0.85);
  if (!dressLook && !bottom && !hidden.includes(R.pelvis))
    add(part(m, (i) => (reg[i] === R.pelvis || (reg[i] === R.thigh && Y(i) > lm.crotch - 0.03)) && Y(i) < lm.hipY + 0.05, 0.003), base);
  if (lm.female && !dressLook && !top && !outer && !hidden.includes(R.torso))
    add(part(m, (i) => reg[i] === R.torso && Y(i) > lm.bustY - 0.06 && Y(i) < lm.bustY + 0.045, 0.004), base);
  if (dressLook) {
    shell({ color: dressLook.color, sleeve: dressLook.sleeve, neck: dressLook.aodai ? 'mandarin' : dressLook.sleeve === 'none' ? 'scoop' : 'crew', rough: 0.5 }, 0.007, lm.waist - 0.03 * H);
    if (dressLook.jump !== 'no') pants(dressLook.color, dressLook.jump === 'shorts' ? 'shorts' : 'full', 0.03, 0.012);
    else {
      if (dressLook.aodai) pants('#F4F1EA', 'full', 0.025, 0.012);
      add(skirtGeo(m, { top: lm.waist, hem: skirtHem[dressLook.hem], ease: 0.014, flare: skirtFlare[dressLook.hem], slits: dressLook.aodai ? 0.3 : 0 }), cloth(dressLook.color, 0.5));
    }
    lowerEase = 0.02;
  } else {
    if (bottom?.part === 'pants') {
      pants(bottom.color, bottom.len, bottom.wide, bottom.ease);
      lowerEase = bottom.ease;
    }
    if (bottom?.part === 'skirt') {
      add(skirtGeo(m, { top: lm.waist, hem: skirtHem[bottom.hem], ease: 0.012, flare: skirtFlare[bottom.hem], pleats: bottom.pleats }), cloth(bottom.color, 0.6));
      lowerEase = 0.02;
    }
    if (top) {
      const tucked = top.tuck && !!bottom;
      const below = lowerEase + 0.005;
      shell(top, tucked ? top.ease : (i) => (Y(i) < lm.waist ? Math.max(top.ease, below) : top.ease), tucked ? lm.waist - 0.03 * H : top.hem === 'crop' ? lm.waist + 0.07 * H : lm.crotch + 0.03 * H);
      if (top.collar) add(new THREE.TorusGeometry(lm.neckR + 0.012, 0.007, 8, 40), cloth(top.color), 0, lm.collar + 0.004, 0.004).rotation.x = Math.PI / 2 - 0.25;
      if (top.hood) add(new THREE.SphereGeometry(1, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.6), cloth(top.color), 0, lm.collar + 0.01, depthAt(m, lm.collar, true) - 0.035).scale.set(0.12 * s, 0.07 * s, 0.07 * s);
    }
  }
  if (outer) {
    shell({ color: outer.color, sleeve: outer.sleeve, open: 0.06, rough: 0.75 }, (i) => (Y(i) < lm.waist ? Math.max(outer.ease, lowerEase + 0.012) : outer.ease), outer.coat ? lm.waist - 0.02 * H : lm.crotch + 0.03 * H);
    if (outer.coat) add(skirtGeo(m, { top: lm.waist, hem: skirtHem.knee, ease: Math.max(0.035, lowerEase + 0.02), flare: 0.06, front: 0.12 }), cloth(outer.color, 0.75));
  }

  const shoes = get('shoes');
  if (shoes) {
    if (shoes.style === 'sandal') {
      add(part(m, (i) => reg[i] === R.foot && Y(i) < 0.012 * H, 0.006), cloth(shoes.color, 0.5));
      add(part(m, (i) => (reg[i] === R.foot && Z(i) > 0.06 * s && Z(i) < 0.085 * s) || ((reg[i] === R.foot || reg[i] === R.calf) && Math.abs(Y(i) - (lm.ankle + 0.004)) < 0.008), 0.007), cloth(shoes.color, 0.5));
    } else {
      const shaft = shoes.style === 'boot' ? lm.ankle + 0.07 * H : 0;
      add(part(m, (i) => reg[i] === R.foot || (!!shaft && reg[i] === R.calf && Y(i) < shaft), shoes.style === 'boot' ? Math.max(0.01, lowerEase + 0.006) : 0.006), cloth(shoes.color, 0.4));
      if (shoes.style === 'sneaker') add(part(m, (i) => reg[i] === R.foot && Y(i) < 0.016 * H, 0.011), cloth('#E2E2E2', 0.6));
    }
  }

  const bag = get('bag');
  if (bag) {
    const mat = cloth(bag.color, 0.5), hx = lm.handX, hy = lm.handY, hz = lm.handZ;
    if (bag.style === 'tote') {
      add(new THREE.BoxGeometry(0.09, 0.26, 0.3), mat, hx + 0.01, hy - 0.22, hz);
      add(new THREE.TorusGeometry(0.075, 0.007, 8, 32, Math.PI), mat, hx + 0.01, hy - 0.09, hz).rotation.y = Math.PI / 2;
    } else if (bag.style === 'clutch') {
      add(new THREE.BoxGeometry(0.035, 0.12, 0.22), mat, hx + 0.012, hy - 0.03, hz + 0.03);
    } else if (bag.style === 'crossbody') {
      const hipW = halfWidthAt(m, lm.hipY), chest = depthAt(m, lm.bustY), waistZ = depthAt(m, lm.waist);
      tube([[-lm.shoulderX * 0.55, lm.collar + 0.01, -0.03], [-lm.shoulderX * 0.5, lm.collar - 0.01, 0.05], [-0.04, lm.bustY + 0.03, chest + 0.018], [0.08, lm.waist, waistZ + 0.03], [hipW + 0.02, lm.hipY + 0.07, 0.02]], 0.006, mat);
      add(new THREE.BoxGeometry(0.06, 0.15, 0.2), mat, hipW + 0.045, lm.hipY - 0.01, 0.01);
    } else {
      const backZ = depthAt(m, lm.bustY - 0.04, true), chestZ = depthAt(m, lm.bustY);
      add(new THREE.BoxGeometry(0.28 * s, 0.36 * s, 0.13), mat, 0, lm.bustY - 0.07, backZ - 0.075);
      for (const k of [-1, 1])
        tube([[k * 0.08, lm.bustY + 0.1, backZ - 0.02], [k * 0.095, lm.collar + 0.012, -0.03], [k * 0.105, lm.collar - 0.01, 0.06], [k * 0.11, lm.bustY + 0.03, chestZ * 0.85 + 0.02], [k * 0.14, lm.armpit - 0.07, 0.03], [k * 0.12, lm.bustY - 0.2, backZ - 0.01]], 0.011, mat);
    }
  }

  const hat = get('hat');
  if (hat) {
    const { headY: cy, headZ: cz, headRx: rx, headRy: ry, headRz: rz } = lm, zr = rz / rx, hm = cloth(hat.color, 0.85);
    if (hat.style === 'beanie') {
      add(new THREE.SphereGeometry(1, 40, 20, 0, Math.PI * 2, 0, Math.PI * 0.43), hm, 0, cy + 0.005, cz).scale.set(rx + 0.012, ry + 0.012, rz + 0.012);
      add(new THREE.CylinderGeometry(1, 1, 0.045, 40, 1, true), hm, 0, cy + ry * 0.3, cz).scale.set(rx + 0.015, 1, rz + 0.015);
    } else if (hat.style === 'cap') {
      add(new THREE.SphereGeometry(1, 40, 20, 0, Math.PI * 2, 0, Math.PI * 0.4), hm, 0, cy + 0.01, cz).scale.set(rx + 0.01, ry + 0.008, rz + 0.01);
      const visor = add(new THREE.CylinderGeometry(1, 1, 0.006, 32, 1, false, -Math.PI / 2, Math.PI), hm, 0, cy + ry * 0.38, cz + rz * 0.8);
      visor.scale.set(rx * 0.95, 1, 0.075);
      visor.rotation.x = 0.18;
    } else {
      add(new THREE.CylinderGeometry(rx * 0.82, rx * 0.95 + 0.012, 0.11, 40), hm, 0, cy + ry * 0.62, cz).scale.z = zr;
      add(new THREE.CylinderGeometry(rx + 0.085, rx + 0.085, 0.006, 48), hm, 0, cy + ry * 0.36, cz).scale.z = zr * 0.95;
      add(new THREE.CylinderGeometry(rx * 0.95 + 0.013, rx * 0.95 + 0.013, 0.022, 40, 1, true), cloth('#1E1B18', 0.6), 0, cy + ry * 0.42, cz).scale.z = zr;
    }
  }

  const eye = get('eyewear');
  if (eye) {
    const em = new THREE.MeshStandardMaterial({ color: eye.color, metalness: eye.tint ? 0.9 : 0.1, roughness: 0.3 });
    const ey = lm.headY + lm.headRy * 0.02, ez = lm.headZ + lm.headRz + 0.012, ex = 0.034 * s;
    for (const k of [-1, 1]) {
      add(new THREE.TorusGeometry(0.021, 0.0028, 8, 32), em, k * ex, ey, ez);
      if (eye.tint) add(new THREE.CircleGeometry(0.021, 32), new THREE.MeshStandardMaterial({ color: '#1a1a1a', transparent: true, opacity: 0.85, roughness: 0.1 }), k * ex, ey, ez);
      add(new THREE.BoxGeometry(0.003, 0.004, lm.headRz + 0.01), em, k * (lm.headRx + 0.002), ey + 0.004, lm.headZ + lm.headRz * 0.45);
    }
    add(new THREE.CylinderGeometry(0.0025, 0.0025, ex * 2 - 0.042, 8), em, 0, ey + 0.006, ez).rotation.z = Math.PI / 2;
  }

  const scarf = get('scarf');
  if (scarf) {
    const sm = cloth(scarf.color, 0.95);
    add(new THREE.TorusGeometry(lm.neckR + 0.032, 0.024, 12, 40), sm, 0, lm.collar + 0.012, 0.004).rotation.x = Math.PI / 2 - 0.2;
    add(new THREE.BoxGeometry(0.075, 0.26, 0.018), sm, 0.05, lm.collar - 0.13, depthAt(m, lm.collar - 0.12) + 0.03).rotation.z = 0.07;
  }

  const belt = get('belt');
  if (belt) {
    const bY = lm.waist - 0.025 * H, bEase = Math.max(0.02, lowerEase + 0.008);
    add(part(m, (i) => (reg[i] === R.torso || reg[i] === R.pelvis) && Math.abs(Y(i) - bY) < 0.016, bEase), cloth(belt.color, 0.4));
    add(new THREE.BoxGeometry(0.04, 0.034, 0.008), metal('#C9A44C'), 0, bY, depthAt(m, bY) + bEase + 0.005);
  }

  const necklace = get('necklace');
  if (necklace) {
    const r0 = lm.neckR + 0.045, gold = metal(necklace.color), tilt = -(Math.PI / 2 - 0.45);
    add(new THREE.TorusGeometry(r0, 0.0022, 8, 64), gold, 0, lm.collar - 0.012, -0.004).rotation.x = tilt;
    add(new THREE.SphereGeometry(0.008, 16, 12), gold, 0, lm.collar - 0.012 - Math.cos(tilt) * r0 - 0.009, -Math.sin(tilt) * r0);
  }

  // Forearm direction at the wrist: watch on the left (-x), bracelet on the right (+x).
  const wristAt = (k: -1 | 1) => {
    const el = new THREE.Vector3(k * (lm.shoulderX + 0.055 * s), 1.105 * s, -0.02 * s), wr = new THREE.Vector3(k * lm.wristX, lm.wrist, lm.wristZ);
    const dir = wr.clone().sub(el).normalize();
    return { dir, at: wr.clone().addScaledVector(dir, -0.022) };
  };
  const ring = (r: number, tube: number, mat: THREE.Material, at: THREE.Vector3, dir: THREE.Vector3) =>
    add(new THREE.TorusGeometry(r, tube, 10, 32), mat, at.x, at.y, at.z).quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);

  const watch = get('watch');
  if (watch) {
    const { at, dir } = wristAt(-1);
    ring(0.029 * s, 0.006, metal(watch.color), at, dir);
    add(new THREE.CylinderGeometry(0.016, 0.016, 0.007, 24), new THREE.MeshStandardMaterial({ color: '#1C1C1F', roughness: 0.2 }), at.x - 0.034 * s, at.y, at.z).rotation.z = Math.PI / 2;
  }

  const bracelet = get('bracelet');
  if (bracelet) {
    const { at, dir } = wristAt(1);
    ring(0.031 * s, 0.004, metal(bracelet.color), at, dir);
  }

  const fingerRing = get('ring');
  if (fingerRing) {
    const { dir } = wristAt(1);
    ring(0.009, 0.0025, metal(fingerRing.color), new THREE.Vector3(lm.handX + 0.004, lm.handY - 0.045 * s, lm.handZ + 0.012), dir);
  }

  const earrings = get('earrings');
  if (earrings) {
    const em = metal(earrings.color);
    for (const k of [-1, 1]) add(new THREE.SphereGeometry(0.0075, 16, 12), em, k * (lm.headRx + 0.002), lm.headY - lm.headRy * 0.32, lm.headZ);
  }

  const tie = get('tie');
  if (tie) {
    const tm = cloth(tie.color, 0.55), top = lm.collar - 0.012, bottom = lm.waist + 0.01, len = top - bottom;
    // Over a tucked shirt the chest sits a few mm out; push the tie a little further than the shirt ease.
    const z = depthAt(m, (top + bottom) / 2) + 0.02;
    add(new THREE.BoxGeometry(0.02, 0.026, 0.014), tm, 0, top, depthAt(m, top) + 0.022);
    add(new THREE.CylinderGeometry(0.012, 0.024, len, 4), tm, 0, top - len / 2, z).scale.z = 0.25;
  }
}
