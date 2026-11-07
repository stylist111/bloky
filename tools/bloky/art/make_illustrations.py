"""Replace the two illustrations that showed AdBlock's hand.

python make_illustrations.py <art_dir> <repo_root>

- disable_site.svg (popup on pages where blocking is impossible): the Bloky icon
  resting on a soft shadow.
- cookie_consent_cutter.svg (Extra filters page): a cookie with the same round
  "prohibited" sign as the Bloky icon.
"""
import base64
import io
import os
import sys

from PIL import Image

ART, ROOT = sys.argv[1], sys.argv[2]
ICONS = os.path.join(ROOT, 'host', 'adblock', 'icons')


def b64(im):
    b = io.BytesIO()
    im.save(b, 'PNG', optimize=True)
    return base64.b64encode(b.getvalue()).decode()


icon = Image.open(os.path.join(ART, 'bloky-master.png')).convert('RGBA').resize((300, 300), Image.LANCZOS)
data = b64(icon)

with open(os.path.join(ICONS, 'disable_site.svg'), 'w', encoding='utf-8') as f:
    f.write(f'''<svg width="258" height="183" viewBox="0 0 258 183" fill="none" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
<defs><radialGradient id="sh" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#1E3A8A" stop-opacity="0.28"/><stop offset="1" stop-color="#1E3A8A" stop-opacity="0"/></radialGradient></defs>
<ellipse cx="129" cy="166" rx="86" ry="13" fill="url(#sh)"/>
<image x="54" y="6" width="150" height="150" href="data:image/png;base64,{data}" xlink:href="data:image/png;base64,{data}"/>
</svg>
''')

cookie = '''<svg width="190" height="105" viewBox="0 0 190 105" fill="none" xmlns="http://www.w3.org/2000/svg">
<defs>
  <radialGradient id="ck" cx="0.38" cy="0.32" r="0.75"><stop offset="0" stop-color="#F6C47A"/><stop offset="1" stop-color="#D98C3A"/></radialGradient>
  <radialGradient id="rd" cx="0.35" cy="0.3" r="0.8"><stop offset="0" stop-color="#FF7A68"/><stop offset="1" stop-color="#E03A34"/></radialGradient>
  <radialGradient id="sh" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#000" stop-opacity="0.18"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
</defs>
<ellipse cx="95" cy="96" rx="48" ry="6" fill="url(#sh)"/>
<path d="M95 12c4 0 7 3 11 3s7-2 10 0c3 3 1 7 4 10s8 2 10 6-2 7 0 11 7 5 7 10-5 7-6 11 2 8-1 11-8 1-11 4-2 8-6 10-7-1-11 0-6 5-11 5-7-4-11-5-8 2-11-1-1-8-4-11-8-2-10-6 2-7 0-11-7-5-7-10 5-7 6-11-2-8 1-11 8-1 11-4 2-8 6-10 7 1 11 0 6-5 11-5z" fill="url(#ck)"/>
<circle cx="76" cy="38" r="5" fill="#6B3A1E"/><circle cx="104" cy="32" r="4" fill="#6B3A1E"/>
<circle cx="68" cy="62" r="4.5" fill="#6B3A1E"/><circle cx="92" cy="54" r="3.5" fill="#6B3A1E"/>
<circle cx="84" cy="80" r="4" fill="#6B3A1E"/><circle cx="116" cy="66" r="3" fill="#6B3A1E"/>
<circle cx="132" cy="70" r="27" fill="#fff" opacity="0.9"/>
<circle cx="132" cy="70" r="23" stroke="url(#rd)" stroke-width="8"/>
<path d="M115.7 53.7L148.3 86.3" stroke="url(#rd)" stroke-width="8"/>
</svg>
'''
with open(os.path.join(ICONS, 'cookie_consent_cutter.svg'), 'w', encoding='utf-8') as f:
    f.write(cookie)
print('ok')
