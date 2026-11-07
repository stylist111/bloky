"""Bloky icons from the designer's logo (tools/bloky/art/logo-source.png).

python make_icons.py <logo-source.png> <repo_root>

1. Cleans the ragged edges of the tile (keeps alpha only inside a smooth rounded square).
2. Writes every icon size the extension uses (same file names as before, so no code
   changes are needed), grey variants for "paused on this site", and a store icon.
   Toolbar sizes (16-20 px) use a zoomed-in crop so the barrier stays readable.
3. Writes a header logo (icon + "Bloky") for every colour theme.
4. Writes docs/img/bloky-256.png for the README; big masters go to _build/art.
"""
import base64
import io
import os
import re
import sys

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageOps

SRC, ROOT = sys.argv[1], sys.argv[2]
ICONS = os.path.join(ROOT, 'host', 'adblock', 'icons')
OUT = os.path.join(ROOT, '_build', 'art')
os.makedirs(OUT, exist_ok=True)
S = 1254


def tile_mask(size=S, radius=335, inset=3):
    m = Image.new('L', (size * 2, size * 2), 0)
    ImageDraw.Draw(m).rounded_rectangle([inset * 2, inset * 2, (size - inset) * 2 - 1, (size - inset) * 2 - 1],
                                        radius=radius * 2, fill=255)
    return m.resize((size, size), Image.LANCZOS)


def master():
    im = Image.open(SRC).convert('RGBA')
    assert im.size == (S, S), im.size
    im.putalpha(ImageChops.multiply(im.split()[3], tile_mask()))
    return im


def small_master(m):
    """Zoom into the window + barrier and put it back on a full tile."""
    box = (150, 175, 1104, 1129)
    zoomed = m.crop(box).resize((S, S), Image.LANCZOS)
    zoomed.putalpha(tile_mask(radius=300, inset=0))
    return zoomed


def down(im, size):
    im = im.copy()
    while im.width // 2 >= size * 2:
        im = im.resize((im.width // 2, im.height // 2), Image.LANCZOS)
    im = im.resize((size, size), Image.LANCZOS)
    if size <= 48:
        im = im.filter(ImageFilter.UnsharpMask(radius=0.6, percent=60, threshold=1))
    return im


def grey(im):
    g = ImageOps.grayscale(im.convert('RGB')).point(lambda v: int(90 + v * 0.55))
    return Image.merge('RGBA', (g, g, g, im.split()[3]))


def png_b64(im):
    b = io.BytesIO()
    im.save(b, 'PNG', optimize=True)
    return base64.b64encode(b.getvalue()).decode()


def theme_text_colour(svg_text):
    """Text colour of a theme logo: the <text> fill if we wrote it before, else the most common fill."""
    m = re.search(r'<text[^>]*fill="([^"]+)"', svg_text)
    if m:
        return m.group(1)
    fills = [f for f in re.findall(r'fill="(#[0-9A-Fa-f]{3,6}|black|white)"', svg_text) if f.upper() != '#E40D0D']
    return max(set(fills), key=fills.count) if fills else '#000'


def logo_svg(icon_b64, colour, beta=False):
    text = 'Bloky' + (' beta' if beta else '')
    width = 360 if beta else 298
    return (f'<svg width="{width}" height="78" viewBox="0 0 {width} 78" fill="none" xmlns="http://www.w3.org/2000/svg" '
            f'xmlns:xlink="http://www.w3.org/1999/xlink">\n'
            f'<image x="0" y="3" width="72" height="72" href="data:image/png;base64,{icon_b64}" '
            f'xlink:href="data:image/png;base64,{icon_b64}"/>\n'
            f'<text x="88" y="56" font-family="Inter, \'Segoe UI\', Roboto, \'Helvetica Neue\', Arial, sans-serif" '
            f'font-size="50" font-weight="700" letter-spacing="-0.5" fill="{colour}">{text}</text>\n</svg>\n')


def main():
    m = master()
    sm = small_master(m)
    m.save(os.path.join(OUT, 'bloky-master.png'))
    sm.save(os.path.join(OUT, 'bloky-small-master.png'))
    m.resize((1024, 1024), Image.LANCZOS).save(os.path.join(OUT, 'bloky-1024.png'))
    down(m, 128).save(os.path.join(OUT, 'bloky-store-128.png'))
    os.makedirs(os.path.join(ROOT, 'docs', 'img'), exist_ok=True)
    down(m, 256).save(os.path.join(ROOT, 'docs', 'img', 'bloky-256.png'), optimize=True)

    pick = lambda s: sm if s <= 20 else m  # noqa: E731
    for s in [16, 19, 20, 32, 38, 40, 48, 64, 128]:
        down(pick(s), s).save(os.path.join(ICONS, f'adblock-{s}.png'), optimize=True)
    for s in [16, 19, 20, 32, 38, 40]:
        grey(down(pick(s), s)).save(os.path.join(ICONS, f'adblock-{s}-allowlisted.png'), optimize=True)
    down(m, 24).save(os.path.join(ICONS, 'icon24.png'), optimize=True)
    down(m, 128).save(os.path.join(ICONS, 'logo.png'), optimize=True)
    for name, s in [('icon16_grayscale.png', 16), ('icon16_grayscale@2x.png', 32),
                    ('icon19-grayscale.png', 19), ('icon38-grayscale.png', 38)]:
        grey(down(pick(s), s)).save(os.path.join(ICONS, name), optimize=True)
    b20 = png_b64(down(m, 40))
    with open(os.path.join(ICONS, 'adblock-20.svg'), 'w', encoding='utf-8') as f:
        f.write(f'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg" '
                f'xmlns:xlink="http://www.w3.org/1999/xlink"><image width="20" height="20" '
                f'href="data:image/png;base64,{b20}" xlink:href="data:image/png;base64,{b20}"/></svg>\n')

    icon144 = png_b64(down(m, 144))
    themes = os.path.join(ICONS, 'themes')
    for t in sorted(os.listdir(themes)):
        for name, beta in [('logo.svg', False), ('beta_logo.svg', True)]:
            p = os.path.join(themes, t, name)
            if os.path.exists(p):
                with open(p, encoding='utf-8') as f:
                    colour = theme_text_colour(f.read())
                with open(p, 'w', encoding='utf-8') as f:
                    f.write(logo_svg(icon144, colour, beta))

    # preview: real sizes on light / tinted / dark toolbars, zoomed 16 and 32, grey 16
    sheet = Image.new('RGB', (900, 160), (255, 255, 255))
    d = ImageDraw.Draw(sheet)
    x = 10
    for bg in ((255, 255, 255), (223, 230, 245), (40, 40, 44)):
        d.rectangle([x, 10, x + 120, 90], fill=bg)
        for i, s in enumerate((16, 20, 32)):
            ic = down(pick(s), s)
            sheet.paste(ic, (x + 8 + i * 36, 30), ic)
        x += 130
    for i, s in enumerate((16, 32)):
        big = down(pick(s), s).resize((128, 128), Image.NEAREST)
        sheet.paste(big, (420 + i * 150, 10), big)
    g = grey(down(sm, 16)).resize((128, 128), Image.NEAREST)
    sheet.paste(g, (720, 10), g)
    sheet.save(os.path.join(OUT, 'preview.png'))
    print('ok')


main()
