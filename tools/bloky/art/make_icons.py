"""Bloky icons from the brand kit (tools/bloky/brand).

python make_icons.py <repo_root>

The kit has hand-made PNGs for 16/19/32/38/48/128 px. The extension also needs 20/40/64 px and a
few other files, so those are drawn here on the same 64-unit grid as logo/bloky-icon.svg
(rounded tile + a "B" made of three blocks), supersampled and scaled down.

Writes (same file names as before, so the code that loads them doesn't change):
- host/adblock/icons/adblock-<size>.png                — active
- host/adblock/icons/adblock-<size>-allowlisted.png    — paused on this site (grey)
- host/adblock/icons/icon*-grayscale*.png              — unavailable (light grey)
- host/adblock/icons/bloky-icon*.svg, adblock-20.svg   — vector icon for pages
- host/adblock/icons/themes/<theme>/logo.svg           — icon + "Bloky" for each colour theme
- docs/img/bloky-256.png, _build/store/icon-128.png (store icon: 96 px artwork + 16 px padding)
"""
import os
import re
import sys

from PIL import Image, ImageDraw

ROOT = sys.argv[1]
KIT = os.path.join(ROOT, 'tools', 'bloky', 'brand')
ICONS = os.path.join(ROOT, 'host', 'adblock', 'icons')
STORE = os.path.join(ROOT, '_build', 'store')

COLORS = {'active': '#2B59FF', 'paused': '#8A94A6', 'unavailable': '#C4CAD4'}
# x0, y0, x1, y1, radius on the 64-unit grid (see logo/bloky-icon.svg)
TILE = (0, 0, 64, 64, 14)
BLOCKS = [(16, 12, 24, 52, 3), (28, 12, 44, 28, 4), (28, 32, 48, 52, 4)]


def draw(state, size, pad=0):
    """Icon of `size` px with `pad` px of transparent margin on every side."""
    k = 16  # supersampling factor
    unit = (size - 2 * pad) * k / 64
    im = Image.new('RGBA', (size * k, size * k), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)

    def box(x0, y0, x1, y1, r, fill):
        o = pad * k
        d.rounded_rectangle([o + x0 * unit, o + y0 * unit, o + x1 * unit - 1, o + y1 * unit - 1],
                            radius=r * unit, fill=fill)

    box(*TILE, COLORS[state])
    for b in BLOCKS:
        box(*b, '#FFFFFF')
    return im.resize((size, size), Image.LANCZOS)


def icon(state, size):
    path = os.path.join(KIT, 'icons', state, f'bloky-{size}.png')
    return Image.open(path).convert('RGBA') if os.path.exists(path) else draw(state, size)


def save(im, *parts):
    path = os.path.join(*parts)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    im.save(path, optimize=True)
    print('saved', os.path.relpath(path, ROOT))


for size in (16, 19, 20, 32, 38, 40, 48, 64, 128):
    save(icon('active', size), ICONS, f'adblock-{size}.png')
for size in (16, 19, 20, 32, 38, 40):
    save(icon('paused', size), ICONS, f'adblock-{size}-allowlisted.png')
save(icon('unavailable', 16), ICONS, 'icon16_grayscale.png')
save(icon('unavailable', 32), ICONS, 'icon16_grayscale@2x.png')
save(icon('unavailable', 19), ICONS, 'icon19-grayscale.png')
save(icon('unavailable', 38), ICONS, 'icon38-grayscale.png')
save(draw('active', 24), ICONS, 'icon24.png')
save(draw('active', 128), ICONS, 'logo.png')
save(draw('active', 256), ROOT, 'docs', 'img', 'bloky-256.png')
save(draw('active', 128, pad=16), STORE, 'icon-128.png')
save(draw('active', 1024), ROOT, '_build', 'art', 'bloky-1024.png')


def svg(name):
    """Kit SVG without the provenance metadata block (it is 4x larger than the drawing)."""
    with open(os.path.join(KIT, 'logo', name), encoding='utf-8') as f:
        text = f.read()
    text = re.sub(r'<metadata>.*?</metadata>', '', text, flags=re.S)
    return text.replace(' xmlns:c2pa="http://c2pa.org/manifest"', '')


def write(text, *parts):
    path = os.path.join(*parts)
    with open(path, 'w', encoding='utf-8', newline='\n') as f:
        f.write(text)
    print('saved', os.path.relpath(path, ROOT))


write(svg('bloky-icon.svg'), ICONS, 'bloky-icon.svg')
write(svg('bloky-icon.svg'), ICONS, 'adblock-20.svg')
write(svg('bloky-icon-paused.svg'), ICONS, 'bloky-icon-paused.svg')
write(svg('bloky-icon-unavailable.svg'), ICONS, 'bloky-icon-unavailable.svg')

# Header logos: ink wordmark on light themes, white wordmark on dark ones.
light = svg('bloky-horizontal.svg')
dark = light.replace('fill="#0B1020"', 'fill="#F2F4F8"')
DARK_THEMES = {'dark', 'solarized', 'rebecca_purple'}
for theme in sorted(os.listdir(os.path.join(ICONS, 'themes'))):
    folder = os.path.join(ICONS, 'themes', theme)
    if os.path.isdir(folder):
        logo = dark if theme in DARK_THEMES else light
        write(logo, folder, 'logo.svg')
        write(logo, folder, 'beta_logo.svg')
