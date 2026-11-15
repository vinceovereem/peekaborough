# Cuts the 4x3 clay sheet into one round, transparent-cornered icon per place category.
import sys, math
from PIL import Image, ImageDraw
import numpy as np
sheet, out = sys.argv[1], sys.argv[2]
KEYS = ['eat','cafe','drink','groceries','shop','services','health','culture','active','green','community','transport']
im = Image.open(sheet).convert('RGB'); W, H = im.size; cw, ch = W / 4, H / 3
SIZE, SS = 160, 4
for i, key in enumerate(KEYS):
    cx0, cy0 = int((i % 4) * cw), int((i // 4) * ch)
    cell = im.crop((cx0, cy0, int(cx0 + cw), int(cy0 + ch)))
    a = np.asarray(cell).astype(int)
    bg = np.median(np.concatenate([a[:6].reshape(-1,3), a[-6:].reshape(-1,3)]), axis=0)
    # the disc is the saturated blob: far from the cream backdrop, or strongly coloured
    fg = (np.abs(a - bg).sum(axis=2) > 90)
    ys, xs = np.nonzero(fg)
    # robust edges: ignore the outer 1% (stray overflow like carrot leaves)
    x0, x1 = np.percentile(xs, [0.6, 99.4]); y0, y1 = np.percentile(ys, [0.6, 99.4])
    cx, cy, r = (x0 + x1) / 2, (y0 + y1) / 2, min(x1 - x0, y1 - y0) / 2 - 1.5
    box = tuple(int(round(v)) for v in (cx - r, cy - r, cx + r, cy + r))
    disc = cell.crop(box).resize((SIZE, SIZE), Image.LANCZOS).convert('RGBA')
    mask = Image.new('L', (SIZE * SS, SIZE * SS), 0)
    ImageDraw.Draw(mask).ellipse((SS, SS, SIZE * SS - SS, SIZE * SS - SS), fill=255)
    disc.putalpha(mask.resize((SIZE, SIZE), Image.LANCZOS))
    disc.save(f'{out}/{key}.webp', quality=88, method=6)
    print(key, box, round(r))
