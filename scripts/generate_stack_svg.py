"""
Stack card generator — renders assets/stack.svg (940x500) for the README.

Two star systems, one engineer: client work with Varejo Consolidado and The Pitch
(the side project), each with its own orbits, the shared tools on the bridge
between them, and the AI copilots on a wide orbit around both.

Planets sit still so no label ever runs over another; what moves is the light
running along each orbit, the stars and the suns breathing.

Zero dependencies. Run: python scripts/generate_stack_svg.py
"""
import math
import os
import random

W, H = 940, 500
SANS = "-apple-system,'Segoe UI',Helvetica,Arial,sans-serif"
INK, MUTED, DIM = '#EDEDED', '#8B949E', '#484F58'
GOLD = '#FFD98A'
C_HALO, C_CORE = '#8AB4F8', '#D6E4FF'   # a blue-white star, neutral colours

V = (288, 252)   # client work: Varejo Consolidado
P = (652, 252)   # The Pitch
ORBITS = [(108, 54), (178, 90)]
OUTER = ((W / 2, 252), (432, 208))

# (system, orbit index, angle in degrees, name, note, colour, label side)
PLANETS = [
    ('V', 0, -128, 'C#', 'language', '#A179DC', 'up'),
    ('V', 0, 18, '.NET', 'platform', '#8E6CF0', 'down'),
    ('V', 1, 148, 'Vue.js', 'frontend', '#42B883', 'down'),
    ('P', 0, -52, 'React Native', '0.83', '#61DAFB', 'up'),
    ('P', 0, 198, 'Expo', 'SDK 55', '#EDEDED', 'up'),
    ('P', 1, -112, 'Supabase', 'backend', '#3ECF8E', 'up'),
    ('P', 1, -14, 'Swift', 'native module', '#F05138', 'up'),
    ('P', 1, 34, 'PostgreSQL', 'data', '#7FA7D9', 'down'),
    ('P', 1, 98, 'NativeWind', 'styling', '#38BDF8', 'down'),
]
SHARED = [
    ((W / 2, 206), 'TypeScript', '5.9', '#3178C6', 'up'),
    ((W / 2, 300), 'Node.js', 'runtime', '#5FA04E', 'down'),
]
COPILOTS = [
    (156, 'Claude Opus 5', 'architecture & review'),
    (-26, 'Claude Fable 5.1', 'daily driver'),
]
CLAUDE = '#D97757'
GLOWS = set()


def on_ellipse(c, r, deg):
    a = math.radians(deg)
    return c[0] + r[0] * math.cos(a), c[1] + r[1] * math.sin(a)


def ellipse_path(c, r):
    cx, cy = c
    rx, ry = r
    return (f'M {cx - rx:.1f} {cy} a {rx} {ry} 0 1 0 {2 * rx} 0 '
            f'a {rx} {ry} 0 1 0 {-2 * rx} 0')


def label(x, y, name, note, side, size=12.5):
    dy_name, dy_note = (-24, -11) if side == 'up' else (22, 35)
    if side == 'up' and not note:
        dy_name = -13
    out = (f'<text x="{x:.1f}" y="{y + dy_name:.1f}" text-anchor="middle" font-family="{SANS}" '
           f'font-size="{size}" font-weight="600" fill="{INK}">{name.replace("&", "&amp;")}</text>')
    if note:
        out += (f'<text x="{x:.1f}" y="{y + dy_note:.1f}" text-anchor="middle" font-family="{SANS}" '
                f'font-size="9.5" fill="{MUTED}">{note.replace("&", "&amp;")}</text>')
    return out


def planet(x, y, color, i, r=5):
    GLOWS.add(color)
    return (f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r * 3.2:.1f}" fill="url(#g{color[1:]})" opacity="0.55">'
            f'<animate attributeName="opacity" values="0.55;0.25;0.55" dur="{3.2 + (i % 4) * 0.7:.1f}s" '
            f'begin="{i * 0.37:.2f}s" repeatCount="indefinite"/></circle>'
            f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r}" fill="{color}"/>'
            f'<circle cx="{x - r * 0.35:.1f}" cy="{y - r * 0.35:.1f}" r="{r * 0.35:.1f}" fill="#FFFFFF" opacity="0.55"/>')


def orbit(c, r, i, trail, opacity=0.14, dash=None, light=True, speed=14.0, comet=0.07):
    d = ellipse_path(c, r)
    out = (f'<path d="{d}" fill="none" stroke="{INK}" stroke-opacity="{opacity}" stroke-width="1"'
           + (f' stroke-dasharray="{dash}"' if dash else '') + '/>')
    if light:
        # a short comet of light running along the orbit
        out += (f'<path d="{d}" pathLength="1" fill="none" stroke="url(#{trail})" stroke-width="1.6" '
                f'stroke-linecap="round" stroke-dasharray="{comet} {1 - comet:.2f}" opacity="0.9">'
                f'<animate attributeName="stroke-dashoffset" from="{(i * 0.23) % 1:.2f}" to="{(i * 0.23) % 1 - 1:.2f}" '
                f'dur="{speed:.1f}s" repeatCount="indefinite"/></path>')
    return out


def sun(c, core, halo, name, note, uid):
    x, y = c
    return f'''
  <circle cx="{x}" cy="{y}" r="74" fill="url(#halo{uid})">
    <animate attributeName="r" values="70;80;70" dur="6s" repeatCount="indefinite"/>
  </circle>
  <circle cx="{x}" cy="{y}" r="15" fill="{core}" opacity="0.35"/>
  <circle cx="{x}" cy="{y}" r="9.5" fill="{core}"/>
  <circle cx="{x - 3}" cy="{y - 3}" r="3.4" fill="#FFFFFF" opacity="0.7"/>
  <text x="{x}" y="{y + 30}" text-anchor="middle" font-family="{SANS}" font-size="13.5" font-weight="700" fill="{INK}">{name}</text>
  <text x="{x}" y="{y + 44}" text-anchor="middle" font-family="{SANS}" font-size="9.5" letter-spacing="0.5" fill="{MUTED}">{note}</text>'''


def stars():
    rnd = random.Random(2026)
    out = []
    for i in range(120):
        x, y = rnd.uniform(14, W - 14), rnd.uniform(14, H - 14)
        r = rnd.choice([0.6, 0.7, 0.8, 1.0, 1.2, 1.5])
        o = rnd.uniform(0.12, 0.42)
        tw = ''
        if i % 6 == 0:
            tw = (f'<animate attributeName="opacity" values="{o:.2f};{min(o + 0.45, 0.9):.2f};{o:.2f}" '
                  f'dur="{rnd.uniform(3, 6):.1f}s" begin="{rnd.uniform(0, 5):.1f}s" repeatCount="indefinite"/>')
        out.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r}" fill="{INK}" opacity="{o:.2f}">{tw}</circle>')
    return ''.join(out)


def build():
    parts = []
    # orbits
    i = 0
    for c, trail in ((V, 'trail0'), (P, 'trail1')):
        for r in ORBITS:
            parts.append(orbit(c, r, i, trail, speed=11 + i * 2.5))
            i += 1
    parts.append(orbit(OUTER[0], OUTER[1], i, 'trail2', opacity=0.12, dash='2 6', speed=34, comet=0.025))

    # bridge between the systems
    bx, by = W / 2, 252
    bridge = (f'<ellipse cx="{bx}" cy="{by}" rx="34" ry="64" fill="url(#bridge)"/>'
              f'<path d="M {V[0] + ORBITS[1][0] - 4} {by} H {P[0] - ORBITS[1][0] + 4}" stroke="{GOLD}" '
              f'stroke-opacity="0.35" stroke-width="1" stroke-dasharray="2 4"/>'
              f'<text x="{bx}" y="{by + 112}" text-anchor="middle" font-family="{SANS}" font-size="8.5" '
              f'letter-spacing="3" fill="{GOLD}" opacity="0.75">SHARED</text>')

    suns = sun(V, C_CORE, C_HALO, 'Varejo Consolidado', 'client · since 10.2026', 'V') + \
        sun(P, GOLD, GOLD, 'The Pitch', 'side project · live on both stores', 'P')

    bodies, labels = [], []
    k = 0
    for sysname, oi, deg, name, note, color, side in PLANETS:
        c = V if sysname == 'V' else P
        x, y = on_ellipse(c, ORBITS[oi], deg)
        bodies.append(planet(x, y, color, k))
        labels.append(label(x, y, name, note, side))
        k += 1
    for (x, y), name, note, color, side in SHARED:
        bodies.append(planet(x, y, color, k))
        labels.append(label(x, y, name, note, side))
        k += 1
    for deg, name, note in COPILOTS:
        x, y = on_ellipse(OUTER[0], OUTER[1], deg)
        bodies.append(planet(x, y, CLAUDE, k, r=5.5))
        labels.append(label(x, y, name, note, 'down' if deg > 0 else 'up'))
        k += 1

    legend_items = [(C_CORE, 'client'), (GOLD, 'side project'), (GOLD, 'shared'), (CLAUDE, 'copilots')]
    lx = W - 30
    legend = []
    for color, text in reversed(legend_items):
        w = len(text) * 6.1 + 22
        lx -= w
        legend.append(f'<circle cx="{lx + 4:.1f}" cy="{H - 30}" r="3" fill="{color}"'
                      + (' fill-opacity="0" stroke="' + color + '" stroke-width="1.2"' if text == 'shared' else '')
                      + f'/><text x="{lx + 12:.1f}" y="{H - 27}" font-family="{SANS}" font-size="9.5" '
                      f'letter-spacing="1.5" fill="{MUTED}">{text}</text>')

    glow_defs = ''.join(
        f'<radialGradient id="g{c[1:]}"><stop offset="0%" stop-color="{c}" stop-opacity="0.8"/>'
        f'<stop offset="100%" stop-color="{c}" stop-opacity="0"/></radialGradient>' for c in sorted(GLOWS))
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" role="img" aria-label="Tech stack as two star systems. Varejo Consolidado (client work): C#, .NET, Vue.js. The Pitch (side project): React Native, Expo, Supabase, Swift, PostgreSQL, NativeWind. Shared: TypeScript and Node.js. Copilots orbiting both: Claude Opus 5 and Claude Fable 5.1.">
<defs>
  <clipPath id="frame"><rect width="{W}" height="{H}" rx="20"/></clipPath>
  {glow_defs}
  <radialGradient id="haloV"><stop offset="0%" stop-color="{C_CORE}" stop-opacity="0.38"/><stop offset="35%" stop-color="{C_HALO}" stop-opacity="0.14"/><stop offset="100%" stop-color="{C_HALO}" stop-opacity="0"/></radialGradient>
  <radialGradient id="haloP"><stop offset="0%" stop-color="{GOLD}" stop-opacity="0.5"/><stop offset="40%" stop-color="{GOLD}" stop-opacity="0.12"/><stop offset="100%" stop-color="{GOLD}" stop-opacity="0"/></radialGradient>
  <radialGradient id="bridge"><stop offset="0%" stop-color="{GOLD}" stop-opacity="0.10"/><stop offset="100%" stop-color="{GOLD}" stop-opacity="0"/></radialGradient>
  <linearGradient id="trail0" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="{C_HALO}"/><stop offset="100%" stop-color="#FFFFFF"/></linearGradient>
  <linearGradient id="trail1" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="{GOLD}"/><stop offset="100%" stop-color="#FFFFFF"/></linearGradient>
  <linearGradient id="trail2" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="{CLAUDE}"/><stop offset="100%" stop-color="#FFFFFF"/></linearGradient>
</defs>
<g clip-path="url(#frame)">
  <rect width="{W}" height="{H}" fill="#0D1117"/>
  {stars()}
  <circle r="1.6" fill="#FFFFFF" opacity="0">
    <animateMotion path="M 760 40 L 520 150" dur="1.4s" begin="4s;comet.end+9s" id="comet"/>
    <animate attributeName="opacity" values="0;0.9;0" dur="1.4s" begin="4s;comet.end+9s"/>
  </circle>
  {''.join(parts)}
  {bridge}
  {suns}
  {''.join(bodies)}
  {''.join(labels)}
  <text x="30" y="36" font-family="{SANS}" font-size="10" font-weight="600" letter-spacing="3" fill="{MUTED}">STACK · 2026</text>
  <text x="{W - 30}" y="36" text-anchor="end" font-family="{SANS}" font-size="10" letter-spacing="2" fill="{MUTED}">two systems, one engineer</text>
  {''.join(legend)}
</g>
<rect x="0.5" y="0.5" width="{W - 1}" height="{H - 1}" rx="20" fill="none" stroke="{INK}" stroke-opacity="0.06"/>
</svg>
'''
    return svg


if __name__ == '__main__':
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    out = os.path.join(root, 'assets', 'stack.svg')
    svg = build()
    with open(out, 'w') as f:
        f.write(svg)
    print(out, len(svg.encode()), 'bytes')
