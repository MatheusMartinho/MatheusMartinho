"""
"Now" card generator — renders assets/now.svg (940x320) for the README.

Four sticky notes taped to a cutting mat: what's actually on my desk this
month. Edit NOTES below and run: python scripts/generate_now_svg.py
"""
import os

W, H = 940, 320
SANS = "-apple-system,'Segoe UI',Helvetica,Arial,sans-serif"
MONO = "ui-monospace,SFMono-Regular,Menlo,Consolas,monospace"
HAND = "'Bradley Hand','Segoe Print','Chalkboard SE','Marker Felt','Comic Sans MS',cursive"
INK, MUTED = '#EDEDED', '#8B949E'
PEN = '#22252A'
MONTH = 'OCTOBER 2026'

NOTES = [
    dict(paper='#E4F2B4', tape='plain', tilt=-3.2,
         title=['Ramping up at', 'Varejo Consolidado'],
         body=[], doodle='chips'),
    dict(paper='#FFE48A', tape='plain', tilt=2.1,
         title=['Hardening', 'The Pitch'],
         body=['security audit,', 'geofence precision,', 'performance under load'], doodle='shield'),
    dict(paper='#FFC8D8', tape='germany', tilt=-1.6,
         title=['Studying', 'German'],
         body=["It's going. Slowly,", "but it's going."], doodle='progress'),
    dict(paper='#BFE2FF', tape='plain', tilt=2.8,
         title=['Break my 5K', 'record'],
         body=['before the year ends'], doodle='stopwatch'),
]

NW, NH = 190, 200
GAP = (W - 2 * 46 - 4 * NW) / 3


def esc(s):
    return s.replace('&', '&amp;').replace("'", '&#8217;')


def tape(kind, x, y):
    if kind == 'germany':
        return (f'<g transform="translate({x} {y + 7}) rotate(-4)" opacity="0.92">'
                f'<rect x="-36" y="-9" width="72" height="6" fill="#1B1B1B"/>'
                f'<rect x="-36" y="-3" width="72" height="6" fill="#DD0000"/>'
                f'<rect x="-36" y="3" width="72" height="6" fill="#FFCE00"/></g>')
    return (f'<rect x="{x - 36}" y="{y - 9}" width="72" height="18" fill="#FFFFFF" fill-opacity="0.42" '
            f'transform="rotate(-4 {x} {y})"/>')


def doodle(kind, x, y):
    """x, y = bottom-left anchor inside the note."""
    def pen(w=2):
        return f'fill="none" stroke="{PEN}" stroke-width="{w}" stroke-linecap="round" stroke-linejoin="round"'
    g = pen()
    if kind == 'chips':
        out, cx = [], x
        for t in ('C#', '.NET', 'Vue.js'):
            w = len(t) * 8.2 + 14
            out.append(f'<rect x="{cx}" y="{y - 22}" width="{w:.0f}" height="22" rx="7" {g}/>'
                       f'<text x="{cx + w / 2:.1f}" y="{y - 6}" text-anchor="middle" font-family="{HAND}" '
                       f'font-size="13" font-weight="700" fill="{PEN}">{t}</text>')
            cx += w + 7
        return ''.join(out)
    if kind == 'shield':
        sx, sy = x + 6, y - 40
        return (f'<path d="M{sx + 17},{sy} L{sx + 34},{sy + 6} V{sy + 19} C{sx + 34},{sy + 30} {sx + 26},{sy + 37} '
                f'{sx + 17},{sy + 41} C{sx + 8},{sy + 37} {sx},{sy + 30} {sx},{sy + 19} V{sy + 6} Z" {g}/>'
                f'<path d="M{sx + 9},{sy + 20} l6,6 l11,-12" {pen(2.4)}>'
                f'<animate attributeName="stroke-dasharray" values="0 40;0 40;40 0" keyTimes="0;0.5;1" dur="2.4s" fill="freeze"/></path>')
    if kind == 'progress':
        out = []
        for i in range(5):
            bx = x + i * 22
            out.append(f'<rect x="{bx}" y="{y - 20}" width="17" height="17" rx="2" {g}/>')
            if i < 2:
                out.append(f'<path d="M{bx + 3},{y - 6} l11,-11 M{bx + 3},{y - 12} l5,-5 M{bx + 9},{y - 6} l5,-5" {pen(1.6)}/>')
        out.append(f'<text x="{x + 116}" y="{y - 6}" font-family="{HAND}" font-size="12" fill="{PEN}">slowly</text>')
        return ''.join(out)
    if kind == 'stopwatch':
        cx, cy = x + 20, y - 20
        return (f'<circle cx="{cx}" cy="{cy}" r="17" {g}/>'
                f'<path d="M{cx - 5},{cy - 24} h10 M{cx},{cy - 24} v6 M{cx + 13},{cy - 15} l4,-4" {g}/>'
                f'<line x1="{cx}" y1="{cy}" x2="{cx}" y2="{cy - 11}" {g}>'
                f'<animateTransform attributeName="transform" type="rotate" from="0 {cx} {cy}" to="360 {cx} {cy}" dur="6s" repeatCount="indefinite"/></line>'
                f'<circle cx="{cx}" cy="{cy}" r="1.8" fill="{PEN}"/>'
                f'<text x="{cx + 28}" y="{cy + 5}" font-family="{HAND}" font-size="13" font-weight="700" fill="{PEN}">PR or bust</text>')
    return ''


def note(i, n):
    x0 = 46 + i * (NW + GAP)
    y0 = 78
    cx, cy = x0 + NW / 2, y0 + NH / 2
    curl = f'M{x0 + NW},{y0 + NH - 26} L{x0 + NW - 26},{y0 + NH} L{x0 + NW},{y0 + NH} Z'
    body = [f'<text x="{x0 + 18}" y="{y0 + 44 + k * 24}" font-family="{HAND}" font-size="19" font-weight="700" fill="{PEN}">{esc(t)}</text>'
            for k, t in enumerate(n['title'])]
    by = y0 + 44 + len(n['title']) * 24 + 4
    body += [f'<text x="{x0 + 18}" y="{by + k * 18}" font-family="{HAND}" font-size="13.5" fill="{PEN}" fill-opacity="0.85">{esc(t)}</text>'
             for k, t in enumerate(n['body'])]
    return f'''
  <g class="note n{i}" style="animation-delay:{0.15 + i * 0.18:.2f}s">
    <g transform="rotate({n['tilt']} {cx} {cy})">
      <rect x="{x0}" y="{y0}" width="{NW}" height="{NH}" fill="{n['paper']}" filter="url(#lift)"/>
      <rect x="{x0}" y="{y0}" width="{NW}" height="{NH}" fill="url(#sheen)"/>
      <path d="{curl}" fill="#000" fill-opacity="0.10"/>
      <path d="M{x0 + NW},{y0 + NH - 26} L{x0 + NW - 26},{y0 + NH}" stroke="#000" stroke-opacity="0.12"/>
      {''.join(body)}
      {doodle(n['doodle'], x0 + 18, y0 + NH - 16)}
      {tape(n['tape'], cx, y0 + 2)}
    </g>
  </g>'''


def mat():
    lines = []
    for x in range(20, W, 20):
        lines.append(f'<line x1="{x}" y1="0" x2="{x}" y2="{H}" stroke="{INK}" stroke-opacity="{0.05 if x % 100 else 0.09}"/>')
    for y in range(20, H, 20):
        lines.append(f'<line x1="0" y1="{y}" x2="{W}" y2="{y}" stroke="{INK}" stroke-opacity="{0.05 if y % 100 else 0.09}"/>')
    ticks = []
    for k, x in enumerate(range(20, W - 10, 10)):
        h = 9 if k % 10 == 0 else (6 if k % 5 == 0 else 3.5)
        ticks.append(f'<line x1="{x}" y1="{H - 1}" x2="{x}" y2="{H - 1 - h}" stroke="{INK}" stroke-opacity="0.25"/>')
        if k % 10 == 0:
            ticks.append(f'<text x="{x + 3}" y="{H - 5}" font-family="{MONO}" font-size="7" fill="{MUTED}" opacity="0.6">{k // 10}</text>')
    return ''.join(lines) + ''.join(ticks)


def build():
    notes = ''.join(note(i, n) for i, n in enumerate(NOTES))
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" role="img" aria-label="Now: {esc('; '.join(' '.join(n['title']) + ' — ' + ' '.join(n['body']) for n in NOTES))}">
<defs>
  <clipPath id="frame"><rect width="{W}" height="{H}" rx="20"/></clipPath>
  <filter id="lift" x="-15%" y="-10%" width="130%" height="135%">
    <feDropShadow dx="0" dy="9" stdDeviation="8" flood-color="#000" flood-opacity="0.55"/>
  </filter>
  <linearGradient id="sheen" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.22"/>
    <stop offset="55%" stop-color="#FFFFFF" stop-opacity="0"/>
    <stop offset="100%" stop-color="#000000" stop-opacity="0.08"/>
  </linearGradient>
  <radialGradient id="lamp" cx="50%" cy="0%" r="75%">
    <stop offset="0%" stop-color="#FFD98A" stop-opacity="0.08"/><stop offset="100%" stop-color="#FFD98A" stop-opacity="0"/>
  </radialGradient>
</defs>
<style>
  .note {{ animation: drop 0.7s cubic-bezier(.2,1.3,.4,1) both; }}
  @keyframes drop {{ from {{ opacity: 0; transform: translateY(-18px); }} to {{ opacity: 1; transform: none; }} }}
  @media (prefers-reduced-motion: reduce) {{ .note {{ animation: none; }} }}
</style>
<g clip-path="url(#frame)">
  <rect width="{W}" height="{H}" fill="#0D1117"/>
  {mat()}
  <rect width="{W}" height="{H}" fill="url(#lamp)"/>
  <text x="30" y="40" font-family="{SANS}" font-size="10" font-weight="600" letter-spacing="3" fill="{MUTED}">NOW · {MONTH}</text>
  <text x="{W - 30}" y="40" text-anchor="end" font-family="{SANS}" font-size="10" letter-spacing="2" fill="{MUTED}">what&#8217;s actually on my desk</text>
  {notes}
</g>
<rect x="0.5" y="0.5" width="{W - 1}" height="{H - 1}" rx="20" fill="none" stroke="{INK}" stroke-opacity="0.06"/>
</svg>
'''


if __name__ == '__main__':
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    out = os.path.join(root, 'assets', 'now.svg')
    svg = build()
    with open(out, 'w') as f:
        f.write(svg)
    print(out, len(svg.encode()), 'bytes')
