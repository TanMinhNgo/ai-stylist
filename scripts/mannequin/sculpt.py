# Original procedural mannequin: smooth-union SDF of anatomical primitives -> marching cubes.
# Regions: 0 head/neck, 1 torso, 2 upper arm, 3 forearm, 4 hand, 5 pelvis, 6 thigh, 7 calf, 8 foot
import numpy as np
from skimage.measure import marching_cubes

def ell(c, r):
    c, r = np.array(c, float), np.array(r, float)
    def f(p):
        q = (p - c) / r; k0 = np.linalg.norm(q, axis=-1); k1 = np.linalg.norm(q / r, axis=-1)
        return k0 * (k0 - 1) / np.maximum(k1, 1e-9)
    return f

def cone(a, b, ra, rb):  # tapered capsule
    a, b = np.array(a, float), np.array(b, float)
    def f(p):
        ba = b - a; pa = p - a; L2 = ba @ ba
        h = np.clip((pa @ ba) / L2, 0, 1)
        d = np.linalg.norm(pa - h[..., None] * ba, axis=-1)
        return d - (ra + (rb - ra) * h)
    return f

def body(sex):
    F = sex == 'f'
    s = 1.0 if F else 1.06
    P = []  # (group, k, sdf)
    def add(g, k, f): P.append((g, k, f))
    def both(fn):
        for sx in (-1, 1): fn(sx)
    hw = 0.172 if F else 0.205   # shoulder joint x
    # head (faceless, egg-shaped) + jaw + subtle nose, neck, trapezius
    add(0, 0.0, ell((0, 1.588, 0.004), (0.079 if F else 0.083, 0.112, 0.097)))
    add(0, 0.02, ell((0, 1.515, 0.038), (0.05 if F else 0.06, 0.042, 0.055)))
    add(0, 0.04, cone((0, 1.40, -0.012), (0, 1.5, 0.006), 0.048 if F else 0.06, 0.04 if F else 0.05))
    both(lambda x: add(1, 0.08, cone((0, 1.455, -0.022), (x * (hw - 0.025), 1.385, -0.012), 0.038, 0.04 if F else 0.05)))
    # torso
    add(1, 0.07, ell((0, 1.27, -0.005), (0.126 if F else 0.158, 0.165, 0.09 if F else 0.102)))
    if F:
        both(lambda x: add(1, 0.04, ell((x * 0.064, 1.272, 0.062), (0.062, 0.056, 0.052))))
    else:
        both(lambda x: add(1, 0.05, ell((x * 0.07, 1.305, 0.048), (0.075, 0.05, 0.045))))
    add(1, 0.08, ell((0, 1.10, 0.004), (0.104 if F else 0.13, 0.11, 0.078 if F else 0.088)))
    add(5, 0.08, ell((0, 0.955, -0.004), (0.17 if F else 0.148, 0.115, 0.1 if F else 0.094)))
    both(lambda x: add(5, 0.04, ell((x * 0.068, 0.915, -0.048), (0.082, 0.088, 0.072 if F else 0.062))))
    # arms (relaxed A-pose)
    def arm(x):
        sh = (x * hw, 1.38, -0.008); el = (x * (hw + 0.055), 1.105, -0.02); wr = (x * (hw + 0.1), 0.865, 0.012)
        add(2, 0.06, cone((sh[0] - x * 0.012, sh[1] + 0.005, sh[2]), el, 0.05 if F else 0.062, 0.031 if F else 0.037))
        add(3, 0.02, cone(el, wr, 0.033 if F else 0.04, 0.022 if F else 0.026))
        add(3, 0.045, ell((x * (hw + 0.07), 1.02, -0.01), (0.035, 0.06, 0.035) if F else (0.043, 0.065, 0.042)))
        add(4, 0.015, ell((x * (hw + 0.11), 0.79, 0.017), (0.021, 0.082, 0.042) if F else (0.024, 0.09, 0.047)))
        add(4, 0.01, cone((x * (hw + 0.1), 0.838, 0.04), (x * (hw + 0.105), 0.795, 0.052), 0.012, 0.01))
    both(arm)
    # legs
    def leg(x):
        hp = (x * 0.088, 0.9, 0.0); kn = (x * 0.092, 0.5, 0.008); an = (x * 0.094, 0.085, -0.012)
        add(6, 0.06, cone(hp, kn, 0.096 if F else 0.088, 0.049))
        add(7, 0.05, ell(kn, (0.042, 0.042, 0.045)))
        add(7, 0.02, cone(kn, an, 0.047, 0.029))
        add(7, 0.035, ell((x * 0.094, 0.37, -0.024), (0.048, 0.095, 0.048) if F else (0.052, 0.1, 0.052)))
        add(8, 0.025, cone((x * 0.094, 0.042, -0.035), (x * 0.1, 0.026, 0.148), 0.036, 0.025))
        add(8, 0.03, ell((x * 0.097, 0.045, 0.045), (0.043, 0.035, 0.1)))
    both(leg)
    return P, s

def build(sex, step=0.0075):
    P, s = body(sex)
    xs = np.arange(-0.36, 0.36, step); ys = np.arange(-0.01, 1.73, step); zs = np.arange(-0.2, 0.24, step)
    G = np.stack(np.meshgrid(xs, ys, zs, indexing='ij'), -1)
    d = np.full(G.shape[:3], 1e9); raw = np.full(G.shape[:3], 1e9)
    for g, k, f in P:
        di = f(G)
        if k > 0:
            h = np.clip(0.5 + 0.5 * (di - d) / k, 0, 1)
            d = di * (1 - h) + d * h - k * h * (1 - h)
        else:
            d = np.minimum(d, di)
    d = np.maximum(d, -G[..., 1])  # flat soles at y=0
    v, faces, _, _ = marching_cubes(d, 0.0, spacing=(step,) * 3)
    v += [xs[0], ys[0], zs[0]]
    # Taubin smoothing
    n = len(v); e = np.concatenate([faces[:, [0, 1]], faces[:, [1, 2]], faces[:, [2, 0]]]); e = np.concatenate([e, e[:, ::-1]])
    deg = np.bincount(e[:, 0], minlength=n)[:, None]
    for lam in [0.5, -0.53] * 6:
        avg = np.zeros_like(v); np.add.at(avg, e[:, 0], v[e[:, 1]]); v = v + lam * (avg / np.maximum(deg, 1) - v)
    # regions: nearest primitive
    best = np.full(n, 1e9); reg = np.zeros(n, int)
    for g, k, f in P:
        di = f(v); m = di < best; best[m] = di[m]; reg[m] = g
    v *= s
    F = sex == 'f'; hw = 0.172 if F else 0.205
    lm = dict(neck=1.40, armpit=1.30, waist=1.10, crotch=0.85, wrist=0.86, knee=0.5, ankle=0.085,
              collar=1.445 if F else 1.425, headY=1.588, headZ=0.004, headRx=0.079 if F else 0.083, headRy=0.112, headRz=0.097,
              neckR=0.044 if F else 0.055, shoulderX=hw, shoulderY=1.38, wristX=hw + 0.1, wristZ=0.012, handX=hw + 0.11, handY=0.79,
              handZ=0.017, hipY=0.955, bustY=1.272, legX=0.093)
    lm = {k: val * s for k, val in lm.items()}
    reg[(reg == 1) & (v[:, 1] < lm['waist'])] = 5
    collar = lm['collar']
    reg[(reg == 0) & (v[:, 1] < collar)] = 1
    reg[(reg == 1) & (v[:, 1] >= collar)] = 0
    reg[(reg == 5) & (v[:, 1] >= lm['waist'])] = 1
    return v, faces, reg, lm

if __name__ == '__main__':
    import sys
    for sex in 'fm':
        v, f, reg, lm = build(sex)
        print(sex, 'verts', len(v), 'tris', len(f), 'height', v[:, 1].max().round(3), np.bincount(reg))
