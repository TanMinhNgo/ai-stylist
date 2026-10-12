"""Generate the Studio mannequins into apps/mobile/assets/mannequin.

    pip install numpy scikit-image
    python scripts/mannequin/export.py

Per body: <name>.bin = positions int16 (metres * 16000, xyz) | indices uint16 | region uint8 per vertex.
mannequin.json holds counts, landmarks and the skirt envelope the app needs to dress the body.
"""
import json
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(__file__))
from sculpt import build  # noqa: E402

OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'apps', 'mobile', 'assets', 'mannequin')


def main():
    os.makedirs(OUT, exist_ok=True)
    meta = {}
    for key, name in (('f', 'female'), ('m', 'male')):
        v, faces, reg, lm = build(key)
        x, y, z = v.T
        h = y.max()
        skirt = []
        for yy in np.arange(lm['knee'] - 0.06 * h, lm['waist'] + 0.001, 0.02 * h):
            m = (np.abs(y - yy) < 0.01 * h) & np.isin(reg, [1, 5, 6, 7])
            if m.any():
                skirt.append([round(float(yy), 4), round(float(np.abs(x[m]).max()), 4), round(float(z[m].max()), 4), round(float(-z[m].min()), 4)])
        assert len(v) < 65536, 'indices are uint16'
        blob = np.round(v * 16000).astype('<i2').tobytes() + faces.astype('<u2').tobytes() + reg.astype('u1').tobytes()
        with open(os.path.join(OUT, f'{name}.bin'), 'wb') as f:
            f.write(blob)
        meta[key] = dict(n=len(v), t=len(faces), lm={k: round(float(val), 4) for k, val in lm.items()}, skirt=skirt)
        print(name, len(v), 'verts', len(faces), 'tris', len(blob) // 1024, 'KB')
    with open(os.path.join(OUT, 'mannequin.json'), 'w') as f:
        json.dump(meta, f, separators=(',', ':'))


if __name__ == '__main__':
    main()
