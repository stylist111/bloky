"""Chrome Web Store images from real screenshots made by tools/bloky/dev/check.mjs.

python make_store.py <repo_root>
reads  _build/shots/*.png and _build/art/bloky-master.png
writes _build/store/: icon-128.png, screenshot-1..4.png (1280x800), promo-440x280.png
"""
import os
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = sys.argv[1]
SHOTS = os.path.join(ROOT, '_build', 'shots')
OUT = os.path.join(ROOT, '_build', 'store')
os.makedirs(OUT, exist_ok=True)
master = Image.open(os.path.join(ROOT, '_build', 'art', 'bloky-master.png')).convert('RGBA')
FONT_B = 'C:/Windows/Fonts/segoeuib.ttf'
FONT_R = 'C:/Windows/Fonts/segoeui.ttf'


def font(path, size):
    return ImageFont.truetype(path, size)


def icon(size):
    im = master.copy()
    while im.width // 2 >= size * 2:
        im = im.resize((im.width // 2, im.height // 2), Image.LANCZOS)
    return im.resize((size, size), Image.LANCZOS)


def gradient(w, h, a=(120, 182, 255), b=(40, 96, 234)):
    g = Image.new('RGB', (w, h))
    px = g.load()
    for y in range(h):
        for x in range(w):
            t = (x / w * 0.6 + y / h * 0.4)
            px[x, y] = tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))
    return g


def shadowed(canvas, im, xy, radius=24, blur=22, alpha=90):
    x, y = xy
    mask = Image.new('L', im.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, im.width - 1, im.height - 1], radius=radius, fill=255)
    sh = Image.new('RGBA', (im.width + blur * 4, im.height + blur * 4), (0, 0, 0, 0))
    sm = Image.new('L', sh.size, 0)
    sm.paste(mask.point(lambda v: v * alpha // 255), (blur * 2, blur * 2))
    sh.putalpha(sm.filter(ImageFilter.GaussianBlur(blur)))
    canvas.alpha_composite(sh, (x - blur * 2, y - blur * 2 + 12))
    rgba = im.convert('RGBA')
    rgba.putalpha(mask)
    canvas.alpha_composite(rgba, (x, y))


def caption(canvas, title, sub, x, y, width):
    d = ImageDraw.Draw(canvas)
    d.text((x, y), title, font=font(FONT_B, 54), fill='white')
    ty = y + 80
    words, line = sub.split(), ''
    for w in words:
        test = (line + ' ' + w).strip()
        if d.textlength(test, font=font(FONT_R, 28)) > width:
            d.text((x, ty), line, font=font(FONT_R, 28), fill=(235, 242, 255))
            ty += 40
            line = w
        else:
            line = test
    d.text((x, ty), line, font=font(FONT_R, 28), fill=(235, 242, 255))


# 1. hero: popup on a real site
c = gradient(1280, 800).convert('RGBA')
pop = Image.open(os.path.join(SHOTS, 'popup-site.png')).convert('RGB')
pop = pop.crop((0, 0, pop.width, int(pop.width * 1.15)))  # popup content area
pop = pop.resize((int(pop.width * 640 / pop.height), 640), Image.LANCZOS)
shadowed(c, pop, (1280 - pop.width - 110, 80))
ic = icon(96)
c.alpha_composite(ic, (90, 150))
caption(c, 'Реклама исчезает', 'Bloky скрывает рекламу, трекеры, окна про cookie и всё, что мешает читать. Бесплатно и без подписок.', 90, 280, 520)
c.convert('RGB').save(os.path.join(OUT, 'screenshot-1.png'))


def page(name, title, sub, n):
    c = gradient(1280, 800).convert('RGBA')
    s = Image.open(os.path.join(SHOTS, name)).convert('RGB').crop((0, 0, 1264, 820))
    s = s.resize((int(1264 * 0.74), int(820 * 0.74)), Image.LANCZOS)
    shadowed(c, s, ((1280 - s.width) // 2, 800 - s.height - 30), radius=16)
    d = ImageDraw.Draw(c)
    w = d.textlength(title, font=font(FONT_B, 44))
    d.text(((1280 - w) / 2, 32), title, font=font(FONT_B, 44), fill='white')
    w = d.textlength(sub, font=font(FONT_R, 24))
    d.text(((1280 - w) / 2, 92), sub, font=font(FONT_R, 24), fill=(235, 242, 255))
    c.convert('RGB').save(os.path.join(OUT, f'screenshot-{n}.png'))


page('options-premium-filters.png', 'Всё, что было платным, — бесплатно', 'Скрытие отвлекающего и окон про cookie включается одной галочкой', 2)
page('options-mab-themes.png', 'Темы оформления', 'Восемь тем для окна и настроек', 3)
page('options-general.png', 'Никакой «ненавязчивой рекламы»', 'Она выключена сразу. Bloky не собирает данные и не показывает свою рекламу', 4)

# promo tile 440x280
t = gradient(440, 280).convert('RGBA')
t.alpha_composite(icon(120), (28, 80))
d = ImageDraw.Draw(t)
d.text((168, 78), 'Bloky', font=font(FONT_B, 56), fill='white')
d.text((170, 152), 'Блокировщик рекламы', font=font(FONT_R, 22), fill=(235, 242, 255))
d.text((170, 182), 'без подписок и слежки', font=font(FONT_R, 22), fill=(235, 242, 255))
t.convert('RGB').save(os.path.join(OUT, 'promo-440x280.png'))

# store icon: 96x96 artwork centred in 128x128 (as the store recommends)
i128 = Image.new('RGBA', (128, 128), (0, 0, 0, 0))
i128.alpha_composite(icon(112), (8, 8))
i128.save(os.path.join(OUT, 'icon-128.png'))
print('ok')
