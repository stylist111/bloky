"""Replace the AdBlock logo (red octagon + white hand + "AdBlock" glyphs) inside the
theme preview SVGs with a round "prohibited" sign and the word "Bloky".

python fix_cards.py <file.svg> [...]   — rewrites files in place, prints what it did.

The logo pieces are found by geometry, not by exact path data, because every card
is drawn at a different scale:
  octagon = square-ish red path; hand = light path inside it;
  text    = path to the right of the octagon, vertically centred on it.
"""
import re
import sys

from svgpathtools import parse_path

PATH_RE = re.compile(r'<path\b[^>]*?/>|<path\b[^>]*?>\s*</path>', re.S)


def attr(tag, name):
    m = re.search(rf'\b{name}="([^"]*)"', tag)
    return m.group(1) if m else None


def rgb(colour):
    if not colour or not colour.startswith('#'):
        return {'white': (255, 255, 255), 'black': (0, 0, 0)}.get(colour or '', None)
    c = colour[1:]
    if len(c) == 3:
        c = ''.join(ch * 2 for ch in c)
    return tuple(int(c[i:i + 2], 16) for i in (0, 2, 4))


def reddish(c):
    return c and c[0] > 170 and c[1] < 110 and c[2] < 110


def bbox(tag):
    d = attr(tag, 'd')
    if not d:
        return None
    try:
        x0, x1, y0, y1 = parse_path(d).bbox()
    except Exception:
        return None
    return x0, y0, x1, y1


def sign(b, colour):
    x0, y0, x1, y1 = b
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    r = (x1 - x0 + y1 - y0) / 4
    sw = r * 0.26
    rr = r - sw / 2
    k = rr * 0.70710678
    return (f'<g><circle cx="{cx:.3f}" cy="{cy:.3f}" r="{rr:.3f}" fill="none" stroke="{colour}" stroke-width="{sw:.3f}"/>'
            f'<path d="M{cx - k:.3f} {cy - k:.3f}L{cx + k:.3f} {cy + k:.3f}" stroke="{colour}" stroke-width="{sw:.3f}"/></g>')


def text(b, colour):
    x0, y0, x1, y1 = b
    h = y1 - y0
    return (f'<text x="{x0:.3f}" y="{y1:.3f}" font-family="Inter, \'Segoe UI\', Roboto, Arial, sans-serif" '
            f'font-size="{h * 1.32:.3f}" font-weight="700" fill="{colour}">Bloky</text>')


def fix(svg):
    tags = [(m.start(), m.end(), m.group(0)) for m in PATH_RE.finditer(svg)]
    info = []
    for s, e, t in tags:
        b = bbox(t)
        info.append((s, e, t, b, rgb(attr(t, 'fill'))))
    repl = {}
    done = 0
    for i, (s, e, t, b, c) in enumerate(info):
        if not b or not c:
            continue
        w, h = b[2] - b[0], b[3] - b[1]
        # the octagon: square-ish, small, drawn with ~8 curved corners (400-1200 chars)
        if not (2 < w < 80 and 0.85 < w / h < 1.15 and 400 < len(attr(t, 'd')) < 1200):
            continue
        # the hand: a differently coloured path inside the octagon
        hand = [j for j, (_, _, _, hb, hc) in enumerate(info)
                if j != i and hb and hc and hc != c
                and hb[0] >= b[0] - 0.5 and hb[2] <= b[2] + 0.5 and hb[1] >= b[1] - 0.5 and hb[3] <= b[3] + 0.5
                and (hb[2] - hb[0]) > w * 0.3]
        if not hand:
            continue
        cy = (b[1] + b[3]) / 2
        # the "AdBlock" glyphs: one long path right next to the octagon
        txt = [j for j, (_, _, tt, tb, tc) in enumerate(info)
               if j != i and j not in hand and tb and tb[0] > b[2] - 0.5 and tb[0] < b[2] + w * 1.5
               and 0.25 * h < (tb[3] - tb[1]) < 0.85 * h and abs((tb[1] + tb[3]) / 2 - cy) < h * 0.25
               and len(attr(tt, 'd')) > 1500]
        if not txt:
            continue
        repl[i] = sign(b, attr(t, 'fill'))
        for j in hand:
            repl[j] = ''
        for j in txt:
            repl[j] = text(info[j][3], attr(info[j][2], 'fill') or '#000')
        done += 1
    out, pos = [], 0
    for i, (s, e, t, b, c) in enumerate(info):
        if i in repl:
            out.append(svg[pos:s])
            out.append(repl[i])
            pos = e
    out.append(svg[pos:])
    return ''.join(out), done, sum(1 for v in repl.values() if v.startswith('<text'))


for f in sys.argv[1:]:
    with open(f, encoding='utf-8') as fh:
        src = fh.read()
    new, n, nt = fix(src)
    if n:
        with open(f, 'w', encoding='utf-8') as fh:
            fh.write(new)
    print(f'{f}: logos={n} texts={nt}')
