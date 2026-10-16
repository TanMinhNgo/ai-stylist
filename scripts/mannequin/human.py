# Realistic Studio bodies from the MakeHuman base mesh (CC0, https://github.com/makehumancommunity/makehuman).
# Base mesh + an Asian young female/male target, arms lowered from MakeHuman's A-pose with the default skin
# weights so front-view PNGs (shot arms-down) line up. Regions match dress.ts R.
# Regions: 0 head/neck, 1 torso, 2 upper arm, 3 forearm, 4 hand, 5 pelvis, 6 thigh, 7 calf, 8 foot, 10 eye, 11 iris
import json
import os
import urllib.request

import numpy as np

SHA = 'a8bc2d54ff0ac92e78ff71431b1023eda42bf482'  # pinned so regenerating gives the same mesh
BASE = f'https://raw.githubusercontent.com/makehumancommunity/makehuman/{SHA}/makehuman/data/'
CACHE = os.path.join(os.path.dirname(__file__), '.mh-cache')
TARGET = {'f': 'asian-female-young', 'm': 'asian-male-young'}
HEIGHT = {'f': 1.62, 'm': 1.72}  # metres, top of head (the hair shell may add a little)

BONE_REGION = [
    (('upperarm',), 2), (('lowerarm',), 3), (('wrist', 'metacarpal', 'finger'), 4),
    (('upperleg',), 6), (('lowerleg',), 7), (('foot', 'toe'), 8),
    (('pelvis', 'root', 'spine05', 'spine04'), 5),
    (('spine', 'breast', 'clavicle', 'shoulder'), 1),
]  # anything else (head, neck, jaw, face muscles, eyes, tongue) is 0


def fetch(path):
    local = os.path.join(CACHE, os.path.basename(path))
    if not os.path.exists(local):
        os.makedirs(CACHE, exist_ok=True)
        urllib.request.urlretrieve(BASE + path, local)
    return local


def load_obj():
    v, groups, cur = [], {}, None
    for line in open(fetch('3dobjs/base.obj')):
        if line.startswith('v '):
            v.append([float(x) for x in line.split()[1:4]])
        elif line.startswith('g '):
            cur = line.split()[1]
        elif line.startswith('f '):
            groups.setdefault(cur, []).append([int(t.split('/')[0]) - 1 for t in line.split()[1:]])
    return np.array(v), {g: np.array(f) for g, f in groups.items()}


def apply_target(v, name):
    for line in open(fetch(f'targets/macrodetails/{name}.target')):
        if line[0].isdigit():
            i, dx, dy, dz = line.split()
            v[int(i)] += (float(dx), float(dy), float(dz))


def bone_weights(n):
    w = json.load(open(fetch('rigs/default_weights.mhw')))['weights']
    out = {}
    for bone, pairs in w.items():
        a = np.zeros(n)
        for i, x in pairs:
            a[i] = x
        out[bone] = a
    return out


def align(a, b):
    """Rotation matrix turning direction a onto direction b (Rodrigues)."""
    a, b = a / np.linalg.norm(a), b / np.linalg.norm(b)
    k, c = np.cross(a, b), a @ b
    K = np.array([[0, -k[2], k[1]], [k[2], 0, -k[0]], [-k[1], k[0], 0]])
    return np.eye(3) + K + K @ K / (1 + c)


def rotate(v, w, centre, R):
    """Linear-blend rotation about centre, per-vertex weight w (0..1)."""
    return v + w[:, None] * (((v - centre) @ R.T + centre) - v)


def build(sex):
    v, groups = load_obj()
    apply_target(v, TARGET[sex])
    n = len(v)
    W = bone_weights(n)
    joint = lambda name: v[np.unique(groups['joint-' + name])].mean(0)

    # Arms hang like the PNGs: upper arm 12 deg out from straight down, forearm 6 deg out and slightly forward.
    posed = {}
    for side, sx in (('L', 1), ('R', -1)):
        lr = side.lower()
        sh, el, hd = joint(f'{lr}-shoulder'), joint(f'{lr}-elbow'), joint(f'{lr}-hand')
        sum_of = lambda keys: np.clip(sum(a for b, a in W.items() if b.endswith('.' + side) and b.startswith(keys)), 0, 1)
        arm, fore = sum_of(('upperarm', 'lowerarm', 'wrist', 'metacarpal', 'finger')), sum_of(('lowerarm', 'wrist', 'metacarpal', 'finger'))
        R = align(el - sh, np.array([sx * np.sin(np.radians(12)), -np.cos(np.radians(12)), 0]))
        v = rotate(v, arm, sh, R)
        el, hd = sh + (el - sh) @ R.T, sh + (hd - sh) @ R.T
        R = align(hd - el, np.array([sx * 0.1, -1, 0.12]))
        v = rotate(v, fore, el, R)
        hd = el + (hd - el) @ R.T
        posed.update({f'{lr}-shoulder': sh, f'{lr}-elbow': el, f'{lr}-hand': hd})

    # Regions from the dominant bone.
    score = np.zeros((n, 9))
    for bone, a in W.items():
        reg = next((r for keys, r in BONE_REGION if bone.startswith(keys)), 0)
        score[:, reg] += a
    reg = score.argmax(1)

    body = groups['body']
    eyes = np.concatenate([groups['helper-l-eye'], groups['helper-r-eye']])
    keep = np.unique(np.concatenate([body.ravel(), eyes.ravel()]))
    reg[np.unique(eyes)] = 10
    for g in ('helper-l-eye', 'helper-r-eye'):  # dark iris on the front cap of each eye
        ids = np.unique(groups[g])
        c = v[ids].mean(0)
        r = np.abs(v[ids] - c).max()
        reg[ids[v[ids][:, 2] > c[2] + 0.55 * r]] = 11

    # Metres, soles on y=0, scaled to a typical adult height.
    floor = np.array([0, v[np.unique(body), 1].min(), 0])
    k = HEIGHT[sex] / (v[np.unique(body), 1].max() - floor[1])
    J = {n: ((posed[n] if n in posed else joint(n)) - floor) * k for n in ('l-shoulder', 'l-elbow', 'l-hand', 'l-knee', 'l-ankle', 'neck')}
    v = (v - floor) * k

    # Short hair is drawn by the app (dress.ts hairMask) from these; MakeHuman's own hair helper is a long fitting
    # shell that hangs over the face.
    hd = (reg == 0) & (v[:, 1] > J['neck'][1])
    hair = dict(hairTop=v[hd, 1].max(), faceFront=v[hd, 2].max(), nape=-0.09 if sex == 'f' else -0.06, female=float(sex == 'f'))

    remap = -np.ones(n, int)
    remap[keep] = np.arange(len(keep))
    quads = np.concatenate([body, eyes])
    faces = remap[np.concatenate([quads[:, [0, 1, 2]], quads[:, [0, 2, 3]]])]
    v, reg = v[keep], reg[keep]

    sh, wr, kn, an, nk = J['l-shoulder'], J['l-hand'], J['l-knee'], J['l-ankle'], J['neck']
    x, y, z = v.T
    def halfwidth(mask, yy):
        m = mask & (np.abs(y - yy) < 0.008)
        return np.abs(x[m]).max() if m.any() else 0
    head = (reg == 0) & (y > nk[1] + 0.04)
    hx, hy, hz = x[head], y[head], z[head]
    torso = np.isin(reg, [1, 5])
    hipY = max(np.arange(an[1] + 0.6, nk[1] - 0.3, 0.005), key=lambda yy: halfwidth(torso, yy))
    chest = np.arange(hipY + 0.12, sh[1] - 0.06, 0.005)
    bustY = max(chest, key=lambda yy: z[torso & (np.abs(y - yy) < 0.008)].max())
    waist = min(np.arange(hipY + 0.05, bustY - 0.05, 0.005), key=lambda yy: halfwidth(torso, yy))
    crotch = y[(reg == 5) & (np.abs(x) < 0.01) & (y < hipY)].min()
    hand = (reg == 4) & (x > 0)
    lm = dict(
        neck=nk[1], collar=nk[1] + 0.02, armpit=sh[1] - 0.09, waist=waist, crotch=crotch, hipY=hipY, bustY=bustY,
        wrist=wr[1], wristX=wr[0], wristZ=wr[2], knee=kn[1], ankle=an[1], legX=kn[0],
        shoulderX=sh[0], shoulderY=sh[1],
        handX=x[hand].mean(), handY=y[hand].mean(), handZ=z[hand].mean(),
        headY=(hy.max() + hy.min()) / 2, headZ=(hz.max() + hz.min()) / 2,
        headRx=np.abs(hx).max(), headRy=(hy.max() - hy.min()) / 2, headRz=(hz.max() - hz.min()) / 2,
        neckR=halfwidth(reg == 0, (nk[1] + y[head].min()) / 2),
        **hair,
    )
    assert crotch < hipY < waist < bustY < lm['shoulderY'] < lm['headY'], lm
    assert lm['wristX'] - lm['shoulderX'] < 0.12, 'arms should hang close to the body'
    return v, faces, reg, {k: float(val) for k, val in lm.items()}


if __name__ == '__main__':
    for sex in 'fm':
        v, f, reg, lm = build(sex)
        print(sex, 'verts', len(v), 'tris', len(f), 'height', v[:, 1].max().round(3), np.bincount(reg))
        print({k: round(val, 3) for k, val in lm.items()})
