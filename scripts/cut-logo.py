# Cuts the clay logo tile off its cream backdrop and writes every size the site uses.
# usage: python3 scripts/cut-logo.py <logo.png> <repo root>
import sys
from PIL import Image, ImageDraw, ImageFilter
import numpy as np
src, root = sys.argv[1], sys.argv[2]
im = Image.open(src).convert('RGB')
a = np.asarray(im).astype(int)
# backdrop and its soft shadow are pale and barely coloured; the tile's rim is strong yellow
pale = ((a.max(axis=2) - a.min(axis=2)) < 100).astype(np.uint8) * 255
back = Image.fromarray(pale).copy()  # fromarray alone is read-only, and floodfill then does nothing
for corner in [(0, 0), (im.width - 1, 0), (0, im.height - 1), (im.width - 1, im.height - 1)]:
    ImageDraw.floodfill(back, corner, 128)          # only pale pixels joined to a corner are backdrop
alpha = Image.fromarray(((np.asarray(back) != 128) * 255).astype(np.uint8))
alpha = alpha.filter(ImageFilter.MinFilter(5)).filter(ImageFilter.GaussianBlur(1.2))  # trim the halo, soften the edge
tile = im.convert('RGBA'); tile.putalpha(alpha)
tile = tile.crop(alpha.point(lambda v: 255 if v > 128 else 0).getbbox())
side = max(tile.size); sq = Image.new('RGBA', (side, side), (0, 0, 0, 0))
sq.paste(tile, ((side - tile.width) // 2, (side - tile.height) // 2))
CREAM = (255, 248, 234)
def on_cream(size, logo, canvas=None):
    canvas = canvas or (size, size)
    out = Image.new('RGB', canvas, CREAM); l = sq.resize((logo, logo), Image.LANCZOS)
    out.paste(l, ((canvas[0] - logo) // 2, (canvas[1] - logo) // 2), l); return out
sq.resize((192, 192), Image.LANCZOS).save(f'{root}/public/logo.webp', quality=90, method=6)   # header, sign-in page
sq.resize((96, 96), Image.LANCZOS).save(f'{root}/app/icon.png', optimize=True)                # browser tab
on_cream(180, 156).save(f'{root}/app/apple-icon.png', optimize=True)                          # phone home screen
on_cream(0, 460, (1200, 630)).save(f'{root}/app/opengraph-image.png', optimize=True)          # link previews
print(sq.size)
