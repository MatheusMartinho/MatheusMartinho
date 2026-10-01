"""
"Now" card generator — renders assets/now.svg (940x268) for the README.

Four columns, one per thing actually on my desk this month. Edit ITEMS and
MONTH below, then run: python scripts/generate_now_svg.py
"""
import os

MONTH = 'October 2026'
ITEMS = [
    dict(kind='WORK', title=['Ramping up at', 'Varejo Consolidado'],
         detail=[], tags=['C#', '.NET', 'Vue.js']),
    dict(kind='PRODUCT', title=['Hardening', 'The Pitch'],
         detail=['Security audit, geofence', 'precision, performance', 'under load.'], tags=[]),
    dict(kind='LANGUAGE', title=['Studying', 'German'],
         detail=["It's going. Slowly,", "but it's going."], tags=[]),
    dict(kind='TRAINING', title=['Breaking my', '5K record'],
         detail=['Before the year ends.'], tags=[]),
]

W, H = 940, 268
PAD = 30
SANS = "-apple-system,'Segoe UI',Helvetica,Arial,sans-serif"
MONO = "ui-monospace,SFMono-Regular,Menlo,Consolas,monospace"
INK, MUTED, DIM, RULE = '#EDEDED', '#8B949E', '#484F58', '#21262D'
GOLD, LIVE = '#FFD98A', '#3FB950'


def esc(s):
    return s.replace('&', '&amp;').replace("'", '&#8217;')


def column(i, item, x, w):
    t = 0.15 + i * 0.12
    fade = (f'<animate attributeName="opacity" values="0;0;1" keyTimes="0;{t / (t + 0.6):.3f};1" '
            f'dur="{t + 0.6:.2f}s" fill="freeze"/>')
    out = [f'<g>{fade}']
    out.append(f'<text x="{x}" y="84" font-family="{MONO}" font-size="10" font-weight="700" fill="{GOLD}">'
               f'{i + 1:02d}</text>')
    out.append(f'<text x="{x + 24}" y="84" font-family="{MONO}" font-size="9.5" letter-spacing="2" '
               f'fill="{MUTED}">{item["kind"]}</text>')
    for k, line in enumerate(item['title']):
        out.append(f'<text x="{x}" y="{114 + k * 21}" font-family="{SANS}" font-size="16.5" font-weight="700" '
                   f'fill="{INK}">{esc(line)}</text>')
    y = 114 + len(item['title']) * 21 + 4
    for k, line in enumerate(item['detail']):
        out.append(f'<text x="{x}" y="{y + k * 17}" font-family="{SANS}" font-size="12" fill="{MUTED}">'
                   f'{esc(line)}</text>')
    if item['tags']:
        tx = x
        for tag in item['tags']:
            tw = len(tag) * 7.2 + 16
            out.append(f'<rect x="{tx}" y="{y - 12}" width="{tw:.0f}" height="20" rx="10" fill="none" '
                       f'stroke="#30363D"/><text x="{tx + tw / 2:.1f}" y="{y + 2}" text-anchor="middle" '
                       f'font-family="{MONO}" font-size="10.5" fill="{INK}">{esc(tag)}</text>')
            tx += tw + 6
    # status + an indeterminate progress track
    sy = H - 44
    out.append(f'<circle cx="{x + 3}" cy="{sy - 3.5}" r="3" fill="{LIVE}"/>'
               f'<circle cx="{x + 3}" cy="{sy - 3.5}" r="3" fill="none" stroke="{LIVE}">'
               f'<animate attributeName="r" values="3;8" dur="2.4s" begin="{i * 0.6:.1f}s" repeatCount="indefinite"/>'
               f'<animate attributeName="stroke-opacity" values="0.7;0" dur="2.4s" begin="{i * 0.6:.1f}s" repeatCount="indefinite"/></circle>')
    out.append(f'<text x="{x + 14}" y="{sy}" font-family="{MONO}" font-size="9.5" letter-spacing="1.6" '
               f'fill="{MUTED}">IN PROGRESS</text>')
    out.append(f'<rect x="{x}" y="{sy + 12}" width="{w}" height="2" rx="1" fill="{RULE}"/>')
    out.append(f'<clipPath id="tr{i}"><rect x="{x}" y="{sy + 11}" width="{w}" height="4"/></clipPath>')
    out.append(f'<rect clip-path="url(#tr{i})" x="{x}" y="{sy + 12}" width="{w * 0.28:.0f}" height="2" rx="1" fill="url(#run)">'
               f'<animate attributeName="x" values="{x - w * 0.28:.0f};{x + w:.0f}" dur="3.2s" '
               f'begin="{i * 0.45:.2f}s" repeatCount="indefinite"/></rect>')
    out.append('</g>')
    return ''.join(out)


def build():
    n = len(ITEMS)
    gap = 28
    colw = (W - 2 * PAD - gap * (n - 1)) / n
    cols, rules = [], []
    for i, item in enumerate(ITEMS):
        x = PAD + i * (colw + gap)
        cols.append(column(i, item, round(x), round(colw)))
        if i:
            rx = x - gap / 2
            rules.append(f'<line x1="{rx:.1f}" y1="70" x2="{rx:.1f}" y2="{H - 26}" stroke="{RULE}"/>')
    label = '; '.join(' '.join(it['title']) + (' (' + ', '.join(it['tags']) + ')' if it['tags'] else '')
                      + (': ' + ' '.join(it['detail']) if it['detail'] else '') for it in ITEMS)
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" role="img" aria-label="Now, {MONTH}: {esc(label)}">
<defs>
  <clipPath id="frame"><rect width="{W}" height="{H}" rx="20"/></clipPath>
  <linearGradient id="run" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0%" stop-color="{GOLD}" stop-opacity="0"/><stop offset="100%" stop-color="{GOLD}"/>
  </linearGradient>
  <radialGradient id="glow" cx="0%" cy="0%" r="70%">
    <stop offset="0%" stop-color="{GOLD}" stop-opacity="0.06"/><stop offset="100%" stop-color="{GOLD}" stop-opacity="0"/>
  </radialGradient>
</defs>
<g clip-path="url(#frame)">
  <rect width="{W}" height="{H}" fill="#0D1117"/>
  <rect width="{W}" height="{H}" fill="url(#glow)"/>
  <text x="{PAD}" y="40" font-family="{SANS}" font-size="10" font-weight="600" letter-spacing="3" fill="{MUTED}">NOW</text>
  <text x="{W - PAD}" y="40" text-anchor="end" font-family="{SANS}" font-size="10" letter-spacing="2" fill="{MUTED}">{MONTH.upper()}</text>
  <line x1="{PAD}" y1="56" x2="{W - PAD}" y2="56" stroke="{RULE}"/>
  {''.join(rules)}
  {''.join(cols)}
</g>
<rect x="0.5" y="0.5" width="{W - 1}" height="{H - 1}" rx="20" fill="none" stroke="{INK}" stroke-opacity="0.08"/>
</svg>
'''


if __name__ == '__main__':
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    out = os.path.join(root, 'assets', 'now.svg')
    svg = build()
    with open(out, 'w') as f:
        f.write(svg)
    print(out, len(svg.encode()), 'bytes')
