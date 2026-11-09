"""Replace the two illustrations that showed AdBlock's hand.

python make_illustrations.py <art_dir> <repo_root>

- disable_site.svg (popup on pages where blocking is impossible): a glass browser window
  like in the logo, with a green check badge instead of the barrier.
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


# "Nothing to block here": the glass browser window from the logo, but with a green
# check badge instead of the barrier — "this page is clean".
with open(os.path.join(ICONS, 'disable_site.svg'), 'w', encoding='utf-8') as f:
    f.write('''<svg width="258" height="183" viewBox="0 0 258 183" fill="none" xmlns="http://www.w3.org/2000/svg">
<defs>
  <linearGradient id="win" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F4F8FF"/><stop offset="1" stop-color="#C9DCFF"/></linearGradient>
  <linearGradient id="pane" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFFFFF" stop-opacity="0.9"/><stop offset="1" stop-color="#DCE8FF" stop-opacity="0.9"/></linearGradient>
  <linearGradient id="pic" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9CC0FF"/><stop offset="1" stop-color="#6E9CF5"/></linearGradient>
  <radialGradient id="ok" cx="0.35" cy="0.3" r="0.8"><stop offset="0" stop-color="#6EE7A0"/><stop offset="1" stop-color="#16A34A"/></radialGradient>
  <radialGradient id="sh" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#1E3A8A" stop-opacity="0.25"/><stop offset="1" stop-color="#1E3A8A" stop-opacity="0"/></radialGradient>
  <filter id="soft" x="-20%" y="-20%" width="140%" height="160%"><feDropShadow dx="0" dy="8" stdDeviation="8" flood-color="#2B4FA8" flood-opacity="0.22"/></filter>
</defs>
<ellipse cx="129" cy="168" rx="92" ry="10" fill="url(#sh)"/>
<g filter="url(#soft)">
  <rect x="40" y="18" width="178" height="132" rx="22" fill="url(#win)" stroke="#FFFFFF" stroke-width="2"/>
  <circle cx="62" cy="38" r="6" fill="#F05A50"/><circle cx="80" cy="38" r="6" fill="#F6C343"/><circle cx="98" cy="38" r="6" fill="#3DB862"/>
  <rect x="52" y="52" width="154" height="86" rx="14" fill="url(#pane)"/>
  <rect x="62" y="62" width="70" height="56" rx="9" fill="url(#pic)"/>
  <path d="M66 114l20-24 13 14 8-8 21 18z" fill="#DCE8FF" opacity="0.9"/>
  <circle cx="117" cy="77" r="7" fill="#DCE8FF"/>
  <rect x="142" y="66" width="54" height="9" rx="4.5" fill="#8DB2F5"/>
  <rect x="142" y="84" width="42" height="9" rx="4.5" fill="#8DB2F5"/>
</g>
<g filter="url(#soft)">
  <circle cx="196" cy="128" r="31" fill="url(#ok)" stroke="#FFFFFF" stroke-width="4"/>
  <path d="M182 128l10 10 19-20" stroke="#FFFFFF" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
</g>
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
