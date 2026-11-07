"""Bloky icons from the designer's master image.

python make_icons.py <source.png> <repo_root>

1. Replaces the red octagon+hand (AdBlock's trademark) with a round red
   "prohibited" sign in the same glossy style, and cleans the ragged tile edges.
2. Writes every icon size the extension uses (same file names as before, so no
   code changes are needed), grey "allowlisted" variants, and a store icon.
3. Writes a header logo (icon + "Bloky") for every colour theme.
"""
import base64
import io
import math
import os
import re
import sys

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageOps

SRC, ROOT = sys.argv[1], sys.argv[2]
ICONS = os.path.join(ROOT, 'host', 'adblock', 'icons')
ART = os.path.dirname(os.path.abspath(__file__))

S = 1254                       # source size
CX, CY = 798, 852              # centre of the old octagon
R_OUT = 226                    # covers the whole octagon incl. its light rim


def lerp(a, b, t):
    return tuple(int(x + (y - x) * t) for x, y in zip(a, b))


def radial_disc(size, r, inner, outer, centre_shift=(-0.25, -0.35)):
    """Disc with a soft radial gradient (light spot up-left), like the 3D style."""
    im = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    px = im.load()
    c = size / 2
    fx, fy = c + centre_shift[0] * r, c + centre_shift[1] * r
    for y in range(size):
        for x in range(size):
            d = math.hypot(x - c, y - c)
            if d <= r + 1:
                t = min(1.0, math.hypot(x - fx, y - fy) / (r * 1.55))
                col = lerp(inner, outer, t)
                a = 255 if d <= r else int(255 * (r + 1 - d))
                px[x, y] = col + (a,)
    return im


def make_sign(scale=2):
    """Round prohibition sign: coral rim, red ring, light face, red slash."""
    r = R_OUT * scale
    size = 2 * r + 8 * scale
    c = size // 2
    sign = Image.new('RGBA', (size, size), (0, 0, 0, 0))

    rim = radial_disc(size, r, (255, 196, 186), (247, 132, 120))
    sign.alpha_composite(rim)

    ring_r = int(r * 0.88)
    ring = radial_disc(size, ring_r, (255, 120, 104), (226, 58, 52))
    sign.alpha_composite(ring)

    face_r = int(r * 0.60)
    face = radial_disc(size, face_r, (255, 250, 250), (250, 222, 224), (-0.2, -0.3))
    # soft inner shadow on the face (top edge), like a pressed-in recess
    shade = Image.new('L', (size, size), 0)
    ImageDraw.Draw(shade).ellipse([c - face_r, c - face_r + 10 * scale, c + face_r, c + face_r + 10 * scale], fill=255)
    shade = ImageChops.subtract(Image.new('L', (size, size), 255), shade).filter(ImageFilter.GaussianBlur(8 * scale))
    face_mask = face.split()[3]
    shade = ImageChops.multiply(shade, face_mask)
    dark = Image.new('RGBA', (size, size), (190, 60, 60, 0))
    dark.putalpha(shade.point(lambda v: int(v * 0.45)))
    sign.alpha_composite(face)
    sign.alpha_composite(dark)

    # diagonal slash (top-left to bottom-right), clipped to the ring's inner edge
    slash = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    w = int(r * 0.30)
    L = ring_r
    ang = math.radians(45)
    dx, dy = math.cos(ang), math.sin(ang)
    nx, ny = -dy, dx
    pts = [(c - dx * L + nx * w / 2, c - dy * L + ny * w / 2), (c + dx * L + nx * w / 2, c + dy * L + ny * w / 2),
           (c + dx * L - nx * w / 2, c + dy * L - ny * w / 2), (c - dx * L - nx * w / 2, c - dy * L - ny * w / 2)]
    grad = radial_disc(size, ring_r, (255, 116, 100), (222, 52, 48))
    m = Image.new('L', (size, size), 0)
    ImageDraw.Draw(m).polygon(pts, fill=255)
    clip = Image.new('L', (size, size), 0)
    ImageDraw.Draw(clip).ellipse([c - face_r - 2, c - face_r - 2, c + face_r + 2, c + face_r + 2], fill=255)
    m = ImageChops.multiply(m, clip)
    slash.paste(grad, (0, 0), m)
    # slash drop shadow onto the face
    sh = Image.new('RGBA', (size, size), (170, 40, 40, 0))
    sh.putalpha(m.filter(ImageFilter.GaussianBlur(6 * scale)).point(lambda v: int(v * 0.35)))
    sign.alpha_composite(sh, (0, 4 * scale))
    sign.alpha_composite(slash)

    # glossy highlight on the upper part of the rim/ring
    gl = Image.new('L', (size, size), 0)
    ImageDraw.Draw(gl).ellipse([c - r * 0.78, c - r * 0.96, c + r * 0.55, c - r * 0.25], fill=255)
    gl = gl.filter(ImageFilter.GaussianBlur(18 * scale))
    gl = ImageChops.multiply(gl, rim.split()[3]).point(lambda v: int(v * 0.30))
    hi = Image.new('RGBA', (size, size), (255, 255, 255, 0))
    hi.putalpha(gl)
    sign.alpha_composite(hi)
    return sign.resize((size // scale, size // scale), Image.LANCZOS)


def tile_mask(size=S, radius=335, inset=3):
    m = Image.new('L', (size * 2, size * 2), 0)
    ImageDraw.Draw(m).rounded_rectangle([inset * 2, inset * 2, (size - inset) * 2 - 1, (size - inset) * 2 - 1],
                                        radius=radius * 2, fill=255)
    return m.resize((size, size), Image.LANCZOS)


def master():
    im = Image.open(SRC).convert('RGBA')
    assert im.size == (S, S), im.size
    # soft drop shadow under the new sign
    sh = Image.new('L', (S, S), 0)
    ImageDraw.Draw(sh).ellipse([CX - R_OUT, CY - R_OUT + 26, CX + R_OUT, CY + R_OUT + 26], fill=255)
    sh = sh.filter(ImageFilter.GaussianBlur(28))
    shadow = Image.new('RGBA', (S, S), (20, 50, 150, 0))
    shadow.putalpha(sh.point(lambda v: int(v * 0.45)))
    im.alpha_composite(shadow)
    sign = make_sign()
    im.alpha_composite(sign, (CX - sign.width // 2, CY - sign.height // 2))
    # clean edges: keep the original alpha inside a smooth rounded square only
    a = ImageChops.multiply(im.split()[3], tile_mask())
    im.putalpha(a)
    # make sure semi-transparent edge pixels are not white fringes
    return im


def down(im, size):
    im = im.copy()
    while im.width // 2 >= size * 2:
        im = im.resize((im.width // 2, im.height // 2), Image.LANCZOS)
    im = im.resize((size, size), Image.LANCZOS)
    if size <= 48:
        im = im.filter(ImageFilter.UnsharpMask(radius=0.6, percent=60, threshold=1))
    return im


def small_master():
    """Toolbar-size variant: the same blue glass tile with only a big sign on it,
    so the sign stays readable at 16-20 px."""
    tile = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    grad = Image.new('RGBA', (S, S))
    gp = grad.load()
    a, b = (150, 200, 252), (40, 96, 234)
    for y in range(S):
        for x in range(S):
            gp[x, y] = lerp(a, b, (x + y) / (2 * S)) + (255,)
    tile.paste(grad, (0, 0), tile_mask(radius=300, inset=0))
    sign = make_sign().resize((int(S * 0.80),) * 2, Image.LANCZOS)
    sh = Image.new('L', (S, S), 0)
    o = (S - sign.width) // 2
    ImageDraw.Draw(sh).ellipse([o, o + 30, o + sign.width, o + sign.height + 30], fill=255)
    shadow = Image.new('RGBA', (S, S), (20, 50, 150, 0))
    shadow.putalpha(sh.filter(ImageFilter.GaussianBlur(30)).point(lambda v: int(v * 0.40)))
    tile.alpha_composite(shadow)
    tile.alpha_composite(sign, (o, o))
    return tile


def grey(im):
    g = ImageOps.grayscale(im.convert('RGB'))
    g = g.point(lambda v: int(90 + v * 0.55))
    out = Image.merge('RGBA', (g, g, g, im.split()[3]))
    return out


def png_b64(im):
    b = io.BytesIO()
    im.save(b, 'PNG', optimize=True)
    return base64.b64encode(b.getvalue()).decode()


def theme_text_colour(svg_text):
    """The logo text colour of a theme = most frequent fill that isn't the red sign / none."""
    fills = re.findall(r'fill="(#[0-9A-Fa-f]{3,6}|black|white)"', svg_text)
    fills = [f for f in fills if f.upper() not in ('#E40D0D',)]
    if not fills:
        return '#000'
    best = max(set(fills), key=fills.count)
    return best


def logo_svg(icon_b64, colour, beta=False):
    text = 'Bloky' + (' beta' if beta else '')
    width = 298 if not beta else 360
    return (f'<svg width="{width}" height="78" viewBox="0 0 {width} 78" fill="none" xmlns="http://www.w3.org/2000/svg" '
            f'xmlns:xlink="http://www.w3.org/1999/xlink">\n'
            f'<image x="0" y="3" width="72" height="72" href="data:image/png;base64,{icon_b64}" '
            f'xlink:href="data:image/png;base64,{icon_b64}"/>\n'
            f'<text x="88" y="56" font-family="Inter, \'Segoe UI\', Roboto, \'Helvetica Neue\', Arial, sans-serif" '
            f'font-size="50" font-weight="700" letter-spacing="-0.5" fill="{colour}">{text}</text>\n</svg>\n')


def main():
    m = master()
    m.save(os.path.join(ART, 'bloky-master.png'))
    m.resize((1024, 1024), Image.LANCZOS).save(os.path.join(ART, 'bloky-1024.png'))
    down(m, 128).save(os.path.join(ART, 'bloky-store-128.png'))

    sm = small_master()
    sm.save(os.path.join(ART, 'bloky-small-master.png'))
    pick = lambda s: sm if s <= 20 else m  # noqa: E731
    sizes = [16, 19, 20, 32, 38, 40, 48, 64, 128]
    for s in sizes:
        down(pick(s), s).save(os.path.join(ICONS, f'adblock-{s}.png'), optimize=True)
    for s in [16, 19, 20, 32, 38, 40]:
        grey(down(pick(s), s)).save(os.path.join(ICONS, f'adblock-{s}-allowlisted.png'), optimize=True)
    # other places that used the old logo as a bitmap
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
            if not os.path.exists(p):
                continue
            with open(p, encoding='utf-8') as f:
                colour = theme_text_colour(f.read())
            with open(p, 'w', encoding='utf-8') as f:
                f.write(logo_svg(icon144, colour, beta))
            print(t, name, colour)

    # preview sheet: real sizes on light/dark toolbars + logos
    sheet = Image.new('RGB', (900, 300), (255, 255, 255))
    d = ImageDraw.Draw(sheet)
    x = 10
    for bg in ((255, 255, 255), (223, 230, 245), (40, 40, 44)):
        d.rectangle([x, 10, x + 120, 90], fill=bg)
        for i, s in enumerate((16, 20, 32)):
            ic = down(pick(s), s)
            sheet.paste(ic, (x + 8 + i * 36, 30), ic)
        x += 130
    for i, s in enumerate((16, 32)):
        big = down(pick(s), s).resize((s * (8 if s == 16 else 4),) * 2, Image.NEAREST)
        sheet.paste(big, (420 + i * 150, 10), big)
    g = grey(down(sm, 16)).resize((128, 128), Image.NEAREST)
    sheet.paste(g, (720, 10), g)
    big = down(m, 256)
    sheet.paste(big, (20, 0 + 40), big) if False else None
    sheet.save(os.path.join(ART, 'preview.png'))


main()
