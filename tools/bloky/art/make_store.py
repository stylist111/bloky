"""Chrome Web Store images from real screenshots made by tools/bloky/dev/check.mjs.

python make_store.py <repo_root>
reads  _build/shots/*.png, _build/art/bloky-master.png, _build/fonts/Montserrat-*.ttf
writes _build/store/: icon-128.png, screenshot-1..4.png (1280x800),
       promo-440x280.png (small tile), marquee-1400x560.png (big banner)
Montserrat (OFL): https://github.com/JulietaUla/Montserrat
"""
import os
import random
import sys

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

ROOT = sys.argv[1]
SHOTS = os.path.join(ROOT, '_build', 'shots')
FONTS = os.path.join(ROOT, '_build', 'fonts')
OUT = os.path.join(ROOT, '_build', 'store')
os.makedirs(OUT, exist_ok=True)
master = Image.open(os.path.join(ROOT, '_build', 'art', 'bloky-master.png')).convert('RGBA')


def font(weight, size):
    return ImageFont.truetype(os.path.join(FONTS, f'Montserrat-{weight}.ttf'), size)


def icon(size):
    im = master.copy()
    while im.width // 2 >= size * 2:
        im = im.resize((im.width // 2, im.height // 2), Image.LANCZOS)
    return im.resize((size, size), Image.LANCZOS)


def aurora(w, h, seed=7):
    """Deep navy base with soft glowing blobs (blue, cyan, violet, a touch of coral) and fine grain."""
    rnd = random.Random(seed)
    base = Image.new('RGB', (w, h))
    px = base.load()
    top, bottom = (14, 22, 70), (24, 48, 140)
    for y in range(h):
        for x in range(w):
            t = (y / h) * 0.7 + (x / w) * 0.3
            px[x, y] = tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(3))
    blobs = [((0.12, 0.15), 0.55, (59, 130, 246)), ((0.85, 0.10), 0.50, (139, 92, 246)),
             ((0.70, 0.95), 0.60, (56, 189, 248)), ((0.05, 0.95), 0.40, (99, 102, 241)),
             ((0.98, 0.60), 0.28, (251, 113, 133))]
    glow = Image.new('RGB', (w, h), (0, 0, 0))
    for (cx, cy), r, col in blobs:
        layer = Image.new('RGB', (w, h), (0, 0, 0))
        rr = r * max(w, h) * 0.5
        ImageDraw.Draw(layer).ellipse([cx * w - rr, cy * h - rr, cx * w + rr, cy * h + rr], fill=col)
        layer = layer.filter(ImageFilter.GaussianBlur(rr * 0.55))
        glow = ImageChops.add(glow, layer.point(lambda v: int(v * 0.85)))
    img = ImageChops.screen(base, glow)
    noise = Image.effect_noise((w, h), 18).convert('RGB')
    img = Image.blend(img, ImageChops.overlay(img, noise), 0.10)
    _ = rnd
    return img.convert('RGBA')


def glow_behind(canvas, im, xy, colour=(120, 170, 255), blur=30, strength=150):
    x, y = xy
    a = im.split()[3].point(lambda v: v * strength // 255)
    pad = blur * 3
    layer = Image.new('RGBA', (im.width + pad * 2, im.height + pad * 2), colour + (0,))
    m = Image.new('L', layer.size, 0)
    m.paste(a, (pad, pad))
    layer.putalpha(m.filter(ImageFilter.GaussianBlur(blur)))
    canvas.alpha_composite(layer, (x - pad, y - pad + 10))
    canvas.alpha_composite(im, (x, y))


def card(canvas, im, xy, radius=22):
    """Screenshot as a floating rounded card with a soft shadow and a thin light border."""
    x, y = xy
    mask = Image.new('L', im.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, im.width - 1, im.height - 1], radius=radius, fill=255)
    blur = 28
    sh = Image.new('RGBA', (im.width + blur * 4, im.height + blur * 4), (5, 10, 40, 0))
    sm = Image.new('L', sh.size, 0)
    sm.paste(mask.point(lambda v: v * 150 // 255), (blur * 2, blur * 2))
    sh.putalpha(sm.filter(ImageFilter.GaussianBlur(blur)))
    canvas.alpha_composite(sh, (x - blur * 2, y - blur * 2 + 18))
    rgba = im.convert('RGBA')
    rgba.putalpha(mask)
    canvas.alpha_composite(rgba, (x, y))
    d = ImageDraw.Draw(canvas)
    d.rounded_rectangle([x, y, x + im.width - 1, y + im.height - 1], radius=radius, outline=(255, 255, 255, 70), width=2)


def pill(canvas, xy, text, f, fill=(251, 113, 133, 255), fg='white', padx=14, pady=6):
    """Rounded label; a translucent fill is blended onto the canvas, not painted over it."""
    x, y = xy
    d = ImageDraw.Draw(canvas)
    w = d.textlength(text, font=f)
    asc, desc = f.getmetrics()
    box = [x, y, x + w + padx * 2, y + asc + desc + pady * 2 - 4]
    layer = Image.new('RGBA', canvas.size, (0, 0, 0, 0))
    ImageDraw.Draw(layer).rounded_rectangle(box, radius=(asc + desc) // 2 + pady, fill=fill)
    canvas.alpha_composite(layer)
    ImageDraw.Draw(canvas).text((x + padx, y + pady - 2), text, font=f, fill=fg)
    return w + padx * 2


def wrap(d, text, f, width):
    lines, line = [], ''
    for w in text.split():
        t = (line + ' ' + w).strip()
        if d.textlength(t, font=f) > width and line:
            lines.append(line)
            line = w
        else:
            line = t
    lines.append(line)
    return lines


SOFT = (214, 226, 255)

# ---------- small promo tile 440x280 ----------
t = aurora(440, 280, 3)
glow_behind(t, icon(132), (26, 74))
d = ImageDraw.Draw(t)
d.text((176, 70), 'Bloky', font=font('ExtraBold', 60), fill='white')
d.text((178, 146), 'Блокировщик рекламы', font=font('SemiBold', 19), fill=SOFT)
d.text((178, 172), 'без подписок и слежки', font=font('SemiBold', 19), fill=SOFT)
pill(t, (178, 210), 'Бесплатно', font('Bold', 16))
t.convert('RGB').save(os.path.join(OUT, 'promo-440x280.png'))

# ---------- marquee 1400x560 ----------
m = aurora(1400, 560, 5)
glow_behind(m, icon(300), (120, 130), blur=50)
d = ImageDraw.Draw(m)
d.text((490, 130), 'Bloky', font=font('ExtraBold', 128), fill='white')
d.text((496, 284), 'Блокировщик рекламы', font=font('SemiBold', 36), fill=SOFT)
d.text((496, 330), 'без подписок и слежки', font=font('SemiBold', 36), fill=SOFT)
x = 496
for txt in ('Бесплатно', 'Без рекламы', 'Не собирает данные'):
    accent = txt == 'Бесплатно'
    x += pill(m, (x, 400), txt, font('Bold', 24), fill=(251, 113, 133, 255) if accent else (255, 255, 255, 46),
              padx=20, pady=10) + 14
m.convert('RGB').save(os.path.join(OUT, 'marquee-1400x560.png'))

# ---------- screenshot 1: popup on a real site ----------
c = aurora(1280, 800, 11)
pop = Image.open(os.path.join(SHOTS, 'popup-site.png')).convert('RGB')
pop = pop.crop((0, 0, int(pop.width * 0.842), int(pop.width * 1.10)))  # symmetric margins
pop = pop.resize((int(pop.width * 640 / pop.height), 640), Image.LANCZOS)
card(c, pop, (1280 - pop.width - 120, 80), radius=26)
glow_behind(c, icon(104), (96, 150), blur=26)
d = ImageDraw.Draw(c)
d.text((96, 290), 'Реклама', font=font('ExtraBold', 64), fill='white')
d.text((96, 362), 'исчезает', font=font('ExtraBold', 64), fill='white')
y = 462
for line in wrap(d, 'Bloky скрывает рекламу, трекеры, окна про cookie и всё, что мешает читать.', font('Medium', 26), 470):
    d.text((96, y), line, font=font('Medium', 26), fill=SOFT)
    y += 38
pill(c, (96, y + 22), 'Бесплатно и без подписок', font('Bold', 22), padx=18, pady=8)
c.convert('RGB').save(os.path.join(OUT, 'screenshot-1.png'))


def page(name, title, sub, n, seed):
    c = aurora(1280, 800, seed)
    s = Image.open(os.path.join(SHOTS, name)).convert('RGB').crop((0, 0, 1264, 820))
    s = s.resize((int(1264 * 0.72), int(820 * 0.72)), Image.LANCZOS)
    card(c, s, ((1280 - s.width) // 2, 800 - s.height - 26), radius=18)
    d = ImageDraw.Draw(c)
    f1, f2 = font('Bold', 44), font('Medium', 24)
    w = d.textlength(title, font=f1)
    d.text(((1280 - w) / 2, 34), title, font=f1, fill='white')
    w = d.textlength(sub, font=f2)
    d.text(((1280 - w) / 2, 98), sub, font=f2, fill=SOFT)
    c.convert('RGB').save(os.path.join(OUT, f'screenshot-{n}.png'))


page('options-premium-filters.png', 'Всё, что было платным, — бесплатно',
     'Скрытие отвлекающего и окон про cookie — одной галочкой', 2, 13)
page('options-mab-themes.png', 'Темы оформления', 'Восемь тем для окна и настроек', 3, 17)
page('options-general.png', 'Без «ненавязчивой рекламы»',
     'Она выключена сразу. Bloky не собирает данные и не показывает свою рекламу', 4, 19)

# store icon: artwork centred in 128x128 with a little transparent padding
i128 = Image.new('RGBA', (128, 128), (0, 0, 0, 0))
i128.alpha_composite(icon(112), (8, 8))
i128.save(os.path.join(OUT, 'icon-128.png'))
print('ok')
