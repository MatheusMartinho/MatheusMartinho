#!/usr/bin/env python3
"""
WakaTime card generator — renders wakatime-card.svg (495×195) for the README.

Zero dependencies (urllib only). Palette mirrors the README: #0D1117 ground,
#EDEDED ink, #8B949E muted. Animations are SMIL, which runs inside GitHub's
<img> proxy (CSS animation does not). Every animated attribute is authored in
its FINAL state and animated *from* the start state, so a renderer without
SMIL still shows the finished card instead of a blank one.

Data sources
  all_time_since_today  → hero number (total hours) + "since <month year>"
  stats/all_time        → languages, editors, daily average, best day
                          (falls back to last_year → last_7_days)
  summaries (14 days)   → daily bars — the free plan exposes two weeks

Local run: reads ~/.wakatime.cfg when WAKATIME_API_KEY is not set.
"""

import base64
import configparser
import datetime as dt
import html
import json
import os
import sys
import urllib.error
import urllib.request

API = "https://wakatime.com/api/v1/users/current/"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "wakatime-card.svg")

W, H = 495, 195
PAD_L, PAD_R = 30, 465
FONT = "-apple-system,'Segoe UI',Helvetica,Arial,sans-serif"
BG, INK, MUTED, DIM = "#0D1117", "#EDEDED", "#8B949E", "#484F58"

# ─────────────────────────────────────────────────────────────── data ──


def api_key() -> str:
    key = os.environ.get("WAKATIME_API_KEY", "").strip()
    if key:
        return key
    cfg = configparser.ConfigParser()
    cfg.read(os.path.expanduser("~/.wakatime.cfg"))
    try:
        return cfg["settings"]["api_key"].strip()
    except KeyError:
        sys.exit("WAKATIME_API_KEY missing (env or ~/.wakatime.cfg)")


def get(path: str, key: str):
    auth = "Basic " + base64.b64encode(key.encode()).decode()
    req = urllib.request.Request(API + path, headers={"Authorization": auth, "User-Agent": "wakatime-card"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


def fetch(key: str) -> dict:
    total = get("all_time_since_today", key)["data"]

    stats = None
    for rng in ("all_time", "last_year", "last_7_days"):
        try:
            cand = get(f"stats/{rng}", key)["data"]
        except urllib.error.HTTPError:
            continue
        if cand.get("languages") and cand.get("status", "ok") in ("ok", "pending_update"):
            stats = cand
            break
    stats = stats or {}

    end = dt.date.today()
    start = end - dt.timedelta(days=13)
    try:
        days = get(f"summaries?start={start}&end={end}", key)["data"]
        daily = [(d["range"]["date"], float(d["grand_total"]["total_seconds"])) for d in days]
    except Exception as e:  # never break the card over the strip
        print(f"summaries unavailable: {e}")
        daily = [((start + dt.timedelta(days=i)).isoformat(), 0.0) for i in range(14)]

    return {"total": total, "stats": stats, "daily": daily[-14:]}


# ────────────────────────────────────────────────────────── helpers ──


def esc(s: str) -> str:
    return html.escape(str(s), quote=True)


def hm(seconds: float) -> str:
    seconds = int(seconds)
    h, m = seconds // 3600, (seconds % 3600) // 60
    return f"{h}h {m:02d}m" if h else f"{m}m"


def trunc(s: str, n: int = 12) -> str:
    return s if len(s) <= n else s[: n - 1] + "…"


def text(x, y, s, size, fill=INK, weight=400, anchor="start", ls=0, opacity=1.0, extra=""):
    ls_attr = f' letter-spacing="{ls}"' if ls else ""
    op_attr = f' opacity="{opacity}"' if opacity != 1.0 else ""
    return (
        f'<text x="{x}" y="{y}" font-family="{FONT}" font-size="{size}" font-weight="{weight}" '
        f'fill="{fill}" text-anchor="{anchor}"{ls_attr}{op_attr}{extra}>{s}</text>'
    )


def odometer(cx_start: float, base: float, digits: str, size: float, uid: str, t0: float = 0.15) -> tuple[str, float]:
    """Scoreboard-style digit roll. Returns (svg, x after the last digit).

    Each digit is a vertical column 0..d clipped to one slot; the column is
    authored resting on the final digit and rolled *from* 0, so without SMIL
    the final number is what you see.
    """
    adv = size * 0.6          # per-digit advance
    row = size * 1.15         # slot pitch
    width = adv * len(digits)
    clip_y, clip_h = base - size * 0.9, size * 1.1
    out = [
        f'<clipPath id="{uid}"><rect x="{cx_start - 3:.1f}" y="{clip_y:.1f}" width="{width + 6:.1f}" height="{clip_h:.1f}"/></clipPath>',
        f'<g clip-path="url(#{uid})">',
    ]
    for i, ch in enumerate(digits):
        d = int(ch)
        cx = cx_start + adv * i + adv / 2
        spans = "".join(f'<tspan x="{cx:.1f}" y="{base + (k - d) * row:.1f}">{k}</tspan>' for k in range(d + 1))
        hold = t0 + i * 0.08
        dur = hold + 1.1
        anim = ""
        if d:
            anim = (
                f'<animateTransform attributeName="transform" type="translate" '
                f'values="0 {d * row:.1f};0 {d * row:.1f};0 0" keyTimes="0;{hold / dur:.3f};1" '
                f'dur="{dur:.2f}s" fill="freeze" calcMode="spline" keySplines="0 0 1 1;0.16 0.84 0.2 1"/>'
            )
        out.append(
            f'<g><text font-family="{FONT}" font-size="{size}" font-weight="700" fill="{INK}" text-anchor="middle">{spans}</text>{anim}</g>'
        )
    out.append("</g>")
    return "\n".join(out), cx_start + width


# ──────────────────────────────────────────────────────────── card ──


def build(data: dict) -> str:
    total, stats, daily = data["total"], data["stats"], data["daily"]

    hours = int(total.get("total_seconds", 0) // 3600)
    since = ""
    start_date = (total.get("range") or {}).get("start_date")
    if start_date:
        since = dt.datetime.strptime(start_date, "%Y-%m-%d").strftime("%b %Y").upper()

    languages = [l for l in stats.get("languages", []) if l.get("percent", 0) > 0]
    editors = stats.get("editors", [])[:3]
    daily_avg = stats.get("daily_average")
    best_day = (stats.get("best_day") or {}).get("total_seconds")

    parts = [
        f'<svg width="{W}" height="{H}" viewBox="0 0 {W} {H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Coding activity — {hours} hours tracked on WakaTime">',
        "<defs>",
        '<radialGradient id="wk-glow" cx="0%" cy="0%" r="70%"><stop offset="0%" stop-color="#EDEDED" stop-opacity="0.05"/><stop offset="100%" stop-color="#EDEDED" stop-opacity="0"/></radialGradient>',
        f'<clipPath id="wk-frame"><rect width="{W}" height="{H}" rx="14"/></clipPath>',
        "</defs>",
        f'<g clip-path="url(#wk-frame)"><rect width="{W}" height="{H}" fill="{BG}"/><rect width="{W}" height="{H}" fill="url(#wk-glow)"/></g>',
    ]

    # ── header: blinking prompt block + eyebrow, source on the right
    parts.append(
        f'<rect x="{PAD_L}" y="19" width="5" height="11" rx="1" fill="{INK}">'
        f'<animate attributeName="opacity" values="1;0" keyTimes="0;0.5" dur="1.1s" calcMode="discrete" repeatCount="indefinite"/></rect>'
    )
    parts.append(text(PAD_L + 11, 29, "CODING ACTIVITY", 10.5, MUTED, 600, ls=2.5))
    right = "WAKATIME" + (f" · SINCE {since}" if since else "")
    parts.append(text(PAD_R, 29, right, 9.5, MUTED, 400, "end", ls=1.5, opacity=0.8))

    # ── hero: rolling hours + unit + caption
    hero_size, hero_base = 40, 84
    odo, x_end = odometer(PAD_L - 1, hero_base, str(hours), hero_size, "wk-odo")
    parts.append(odo)
    parts.append(text(f"{x_end + 3:.1f}", hero_base, "h", 18, MUTED, 600))
    caption = ["all time"]
    if daily_avg:
        caption.append(f"avg {hm(daily_avg)} / day")
    if best_day:
        caption.append(f"best day {hm(best_day)}")
    parts.append(text(PAD_L, 103, esc(" · ".join(caption)), 9.5, MUTED, opacity=0.85))

    # ── last 14 days: thin columns, best day in full ink and labeled
    base_y, max_h, slot, bw = 94, 40, 12, 8
    x0 = PAD_R - (14 * slot - (slot - bw))
    peak = max((s for _, s in daily), default=0)
    for i, (day, secs) in enumerate(daily):
        x = x0 + i * slot
        is_peak = peak > 0 and secs == peak
        if secs <= 0:
            parts.append(f'<rect x="{x}" y="{base_y - 2}" width="{bw}" height="2" rx="1" fill="{INK}" opacity="0.18"/>')
            continue
        h = max(3.0, secs / peak * max_h)
        y = base_y - h
        hold = 0.35 + i * 0.05
        dur = hold + 0.7
        kt = f'keyTimes="0;{hold / dur:.3f};1" dur="{dur:.2f}s" fill="freeze" calcMode="spline" keySplines="0 0 1 1;0.2 0.7 0.2 1"'
        parts.append(
            f'<rect x="{x}" y="{y:.1f}" width="{bw}" height="{h:.1f}" rx="2" fill="{INK}" opacity="{1.0 if is_peak else 0.5}">'
            f'<animate attributeName="height" values="0;0;{h:.1f}" {kt}/>'
            f'<animate attributeName="y" values="{base_y};{base_y};{y:.1f}" {kt}/></rect>'
        )
        if is_peak:
            parts.append(
                text(f"{x + bw / 2:.1f}", f"{y - 5:.1f}", hm(secs), 8.5, INK, 600, "middle", opacity=1.0,
                     extra=' ><animate attributeName="opacity" values="0;0;1" keyTimes="0;0.75;1" dur="1.6s" fill="freeze"/')
            )
    parts.append(text(PAD_R, 106, "LAST 14 DAYS", 8, MUTED, 600, "end", ls=1.8, opacity=0.6))

    # ── languages: stacked band with 2px surface gaps, filling left → right
    band_y, band_h, gap = 122, 8, 2
    band_w = PAD_R - PAD_L
    # top five named languages; a real "Other" plus everything past the top five fold into one tail bucket
    named = [l for l in languages if l["name"].lower() != "other"]
    top = named[:5]
    other_total = sum(l["percent"] for l in languages) - sum(l["percent"] for l in top)
    segs = [(trunc(l["name"]), l["percent"]) for l in top]
    if other_total > 0.05:
        segs.append(("Other", other_total))
    tones = [0.95, 0.7, 0.5, 0.36, 0.26, 0.18]
    total_pct = sum(p for _, p in segs) or 1
    avail = band_w - gap * (len(segs) - 1)
    x = PAD_L
    fill_T = 1.1
    legend = []
    for i, (name, pct) in enumerate(segs):
        w = max(3.0, pct / total_pct * avail)
        s = 0.25 + (x - PAD_L) / band_w * fill_T
        dur = s + max(0.05, w / band_w * fill_T)
        parts.append(
            f'<rect x="{x:.1f}" y="{band_y}" width="{w:.1f}" height="{band_h}" rx="2" fill="{INK}" opacity="{tones[i]}">'
            f'<animate attributeName="width" values="0;0;{w:.1f}" keyTimes="0;{s / dur:.3f};1" dur="{dur:.2f}s" fill="freeze"/></rect>'
        )
        legend.append((name, pct, tones[i]))
        x += w + gap

    # ── legend: one flowing <text> so real glyph widths set the spacing — nothing can collide.
    # Five entries when a conservative width estimate fits, otherwise the tail folds into Other.
    def est(items):
        return sum(len(f"{n} {p:.0f}%") * 6.0 + 26 for n, p, _ in items)

    if est(legend) > band_w - 20 and len(legend) > 4:
        keep, tail = legend[:3], legend[3:]
        other_pct = sum(p for _, p, _ in tail)
        legend = keep + [("Other", other_pct, tones[3])]
        # redraw the band to match the folded legend
        parts[:] = [q for q in parts if not (q.startswith(f'<rect x="') and f'y="{band_y}" width=' in q)]
        avail = band_w - gap * (len(legend) - 1)
        x = PAD_L
        for i, (name, pct, tone) in enumerate(legend):
            w = max(3.0, pct / total_pct * avail)
            s = 0.25 + (x - PAD_L) / band_w * fill_T
            dur = s + max(0.05, w / band_w * fill_T)
            parts.append(
                f'<rect x="{x:.1f}" y="{band_y}" width="{w:.1f}" height="{band_h}" rx="2" fill="{INK}" opacity="{tone}">'
                f'<animate attributeName="width" values="0;0;{w:.1f}" keyTimes="0;{s / dur:.3f};1" dur="{dur:.2f}s" fill="freeze"/></rect>'
            )
            x += w + gap

    ly = 147
    runs = []
    for i, (name, pct, tone) in enumerate(legend):
        sep = "" if i == 0 else '<tspan fill="none">&#160;&#160;&#160;&#160;</tspan>'
        runs.append(
            f'{sep}<tspan font-size="7.5" fill-opacity="{tone}">&#9679;</tspan>'
            f'<tspan font-size="9.5">&#160;{esc(name)}</tspan><tspan fill="{MUTED}" font-weight="400"> {pct:.0f}%</tspan>'
        )
    parts.append(f'<text x="{PAD_L}" y="{ly}" font-family="{FONT}" font-size="9.5" fill="{INK}" font-weight="600">{"".join(runs)}</text>')

    # ── footer: editors on the left, source on the right
    if editors:
        ed = " · ".join(f"{esc(trunc(e['name'], 14))} {e['percent']:.0f}%" for e in editors)
        parts.append(text(PAD_L, 176, ed, 9, MUTED, opacity=0.8))
    parts.append(text(PAD_R, 176, "wakatime · updated daily", 9, DIM, anchor="end"))

    parts.append(f'<rect x="0.5" y="0.5" width="{W - 1}" height="{H - 1}" rx="14" fill="none" stroke="{INK}" stroke-opacity="0.10"/>')
    parts.append("</svg>")
    return "\n".join(parts) + "\n"


def main() -> None:
    key = api_key()
    print("fetching WakaTime data…")
    data = fetch(key)
    svg = build(data)
    with open(os.path.normpath(OUT), "w", encoding="utf-8") as f:
        f.write(svg)
    hours = int(data["total"].get("total_seconds", 0) // 3600)
    print(f"wrote {os.path.normpath(OUT)} — {hours}h total, {len(data['stats'].get('languages', []))} languages")


if __name__ == "__main__":
    main()
