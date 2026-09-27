// Renders assets/constellation.svg from the GitHub contribution calendar.
// Zero dependencies. Runs in a GitHub Action with the built-in GITHUB_TOKEN.

const fs = require("fs");
const path = require("path");

const LOGIN = process.env.GH_LOGIN || "MatheusMartinho";
// GH_PAT (optional) sees private contributions even when the profile hides them; GITHUB_TOKEN otherwise.
const TOKEN = process.env.GH_PAT || process.env.GITHUB_TOKEN;
const OUT = process.env.OUT || path.join(__dirname, "..", "assets", "constellation.svg");

// Palette mirrors the README: #0D1117 ground, #EDEDED ink, #8B949E muted, #21262D rule.
const P = {
  bg: "#0D1117",
  rule: "#21262D",
  faint: "#30363D",
  muted: "#8B949E",
  soft: "#C9D1D9",
  ink: "#EDEDED",
  gold: "#FFD98A",
};

async function fetchCalendar() {
  if (!TOKEN) throw new Error("GITHUB_TOKEN missing");
  const query = `query($login:String!){
    user(login:$login){
      contributionsCollection{
        contributionCalendar{
          totalContributions
          weeks{ contributionDays{ contributionCount date weekday } }
        }
      }
    }
  }`;
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: { Authorization: `bearer ${TOKEN}`, "Content-Type": "application/json", "User-Agent": "constellation" },
    body: JSON.stringify({ query, variables: { login: LOGIN } }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  return json.data.user.contributionsCollection.contributionCalendar;
}

// Deterministic jitter so the sky is stable between runs.
function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) / 4294967295;
}

// Current streak (alive while today is still open), the longest run of the year, and the best
// run before this one, so a streak that is setting the record can say what it passed.
function streaks(days, today) {
  const past = days.filter((d) => d.date <= today).sort((a, b) => a.date.localeCompare(b.date));
  const runs = [];
  let open = null;
  for (const d of past) {
    if (d.contributionCount > 0) {
      if (!open) { open = { len: 0, end: null }; runs.push(open); }
      open.len++; open.end = d.date;
    } else open = null;
  }
  // Walk back from today; a quiet today does not break the streak yet.
  let i = past.length - 1;
  if (i >= 0 && past[i].date === today && past[i].contributionCount === 0) i--;
  const streakDays = [];
  for (; i >= 0 && past[i].contributionCount > 0; i--) streakDays.unshift(past[i].date);
  const mine = streakDays.length ? runs[runs.length - 1] : null;
  let longest = 0, longestEnd = null, prevBest = 0;
  for (const r of runs) {
    if (r.len > longest) { longest = r.len; longestEnd = r.end; }
    if (r !== mine && r.len > prevBest) prevBest = r.len;
  }
  return { current: streakDays.length, streakDays: new Set(streakDays), longest, longestEnd, prevBest };
}

function render(cal, today) {
  const weeks = cal.weeks;
  const W = 1000, H = 300;
  // padT leaves room for two header rows: the totals, then the streak lamps.
  const padL = 28, padR = 28, padT = 66, padB = 44;
  const cols = weeks.length;
  const cw = (W - padL - padR) / cols;
  const rh = (H - padT - padB) / 7;

  const stars = [];
  weeks.forEach((wk, ci) => {
    wk.contributionDays.forEach((d) => {
      const jx = (hash(d.date + "x") - 0.5) * cw * 0.9;
      const jy = (hash(d.date + "y") - 0.5) * rh * 0.9;
      stars.push({
        x: padL + ci * cw + cw / 2 + jx,
        y: padT + d.weekday * rh + rh / 2 + jy,
        n: d.contributionCount,
        date: d.date,
      });
    });
  });

  // Star size and tone by count.
  const tone = (n) =>
    n === 0 ? { r: 0.9, c: P.rule, glow: false } :
    n <= 3  ? { r: 1.6, c: P.muted, glow: false } :
    n <= 9  ? { r: 2.3, c: P.soft, glow: true } :
              { r: 3.2, c: P.ink, glow: true };

  // Constellation: the brightest day of each month, joined in time order.
  const byMonth = new Map();
  for (const s of stars) {
    if (s.n === 0) continue;
    const m = s.date.slice(0, 7);
    if (!byMonth.has(m) || byMonth.get(m).n < s.n) byMonth.set(m, s);
  }
  const bright = [...byMonth.values()].sort((a, b) => a.date.localeCompare(b.date));
  const poly = bright.map((s) => `${s.x.toFixed(1)},${s.y.toFixed(1)}`).join(" ");
  // Path length for the draw-in animation.
  let plen = 0;
  for (let i = 1; i < bright.length; i++) plen += Math.hypot(bright[i].x - bright[i - 1].x, bright[i].y - bright[i - 1].y);
  plen = Math.ceil(plen) + 10;
  // Rings on the constellation nodes, pulsing in sequence.
  // Static faint ring on every node, plus a SMIL pulse (SMIL runs inside <img> even with reduced motion).
  const nodeSvg = bright.map((s, i) =>
    `<circle cx="${s.x.toFixed(1)}" cy="${s.y.toFixed(1)}" r="5.5" fill="none" stroke="${P.soft}" stroke-width="0.8" opacity="0.45"/>` +
    `<circle cx="${s.x.toFixed(1)}" cy="${s.y.toFixed(1)}" r="5.5" fill="none" stroke="${P.ink}" stroke-width="0.9" opacity="0">` +
    `<animate attributeName="r" values="3;11" dur="2.4s" begin="${(0.5 * i).toFixed(2)}s;pulse${i}.end+${(bright.length * 0.5 + 3).toFixed(1)}s" id="pulse${i}"/>` +
    `<animate attributeName="opacity" values="0.9;0" dur="2.4s" begin="${(0.5 * i).toFixed(2)}s;pulse${i}.end+${(bright.length * 0.5 + 3).toFixed(1)}s"/>` +
    `</circle>`
  ).join("\n");

  // Month ticks along the bottom.
  const ticks = [];
  let lastM = null;
  weeks.forEach((wk, ci) => {
    const m = wk.contributionDays[0].date.slice(0, 7);
    if (m !== lastM) {
      lastM = m;
      const x = padL + ci * cw;
      const label = new Date(wk.contributionDays[0].date + "T00:00:00Z")
        .toLocaleString("en", { month: "short", timeZone: "UTC" }).toLowerCase();
      // A month that only owns a sliver of the first week would collide with the next label.
      if (ticks.length && x - ticks[ticks.length - 1].x < cw * 3) ticks.pop();
      ticks.push({ x, label });
    }
  });

  const peak = stars.reduce((a, b) => (b.n > a.n ? b : a), stars[0]);
  const active = stars.filter((s) => s.n > 0).length;
  const sk = streaks(weeks.flatMap((w) => w.contributionDays), today);

  // The current streak. In the sky its days run down a week column and wrap to the top of the
  // next, so a line through them zigzags. The gold stars stay unjoined instead, and a light runs
  // through them in date order; the header carries the run as a straight row of lamps.
  const run = stars.filter((s) => sk.streakDays.has(s.date)).sort((a, b) => a.date.localeCompare(b.date));
  const order = new Map(run.map((s, i) => [s.date, i]));
  const todayStar = stars.find((s) => s.date === today);
  const todayLit = sk.streakDays.has(today);

  // One clock for the lamps and the sky: lamp i and star i light up together, then the ring on
  // the next day answers, then a rest before the next pass.
  const STEP = Math.min(0.14, 2.4 / Math.max(1, run.length));
  const CYCLE = +(run.length * STEP + 3.6).toFixed(2);
  const nextAt = (run.length * STEP).toFixed(2);
  const k = (sec) => (sec / CYCLE).toFixed(4);
  const flash = (i, attr, from, to) =>
    `<animate attributeName="${attr}" values="${from};${to};${from};${from}" keyTimes="0;${k(0.18)};${k(0.75)};1" dur="${CYCLE}s" begin="${(i * STEP).toFixed(2)}s" repeatCount="indefinite"/>`;
  // An expanding ring, once per pass, when the light reaches the end of the run.
  const ping = (cx, cy, r0, r1) =>
    `<circle cx="${cx}" cy="${cy}" r="${r0}" fill="none" stroke="${P.gold}" stroke-width="0.9" opacity="0">` +
    `<animate attributeName="r" values="${r0};${r1};${r1}" keyTimes="0;${k(1.4)};1" dur="${CYCLE}s" begin="${nextAt}s" repeatCount="indefinite"/>` +
    `<animate attributeName="opacity" values="0.9;0;0" keyTimes="0;${k(1.4)};1" dur="${CYCLE}s" begin="${nextAt}s" repeatCount="indefinite"/>` +
    `</circle>`;

  // A soft gold halo behind each star of the run, so the run reads as one lit patch of sky.
  const haloSvg = run.map((s, i) => {
    const r = (Math.max(tone(s.n).r, 2.4) + 4.2).toFixed(1);
    return `<circle cx="${s.x.toFixed(1)}" cy="${s.y.toFixed(1)}" r="${r}" fill="${P.gold}" opacity="0.16" filter="url(#halo)">${flash(i, "opacity", 0.16, 0.42)}</circle>`;
  }).join("\n");

  // Where the run stands now. A quiet today gets a dashed ring on its own star: the day that keeps
  // the streak alive. Once today counts, a solid ring sits on today's gold star instead.
  let ringSvg = "";
  if (todayStar && !todayLit) {
    const cx = todayStar.x.toFixed(1), cy = todayStar.y.toFixed(1);
    ringSvg = `<circle cx="${cx}" cy="${cy}" r="5.6" fill="none" stroke="${P.gold}" stroke-width="1" stroke-dasharray="1.6 2.4" opacity="0.9"/>` + ping(cx, cy, 5.6, 12);
  } else if (run.length) {
    const head = run[run.length - 1];
    const cx = head.x.toFixed(1), cy = head.y.toFixed(1);
    ringSvg = `<circle cx="${cx}" cy="${cy}" r="6.2" fill="none" stroke="${P.gold}" stroke-width="0.9" opacity="0.6"/>` + ping(cx, cy, 6.2, 13);
  }

  // The header row: the run as lamps, one per day, lit in gold; the next day as an open ring;
  // then unlit lamps out to the longest run of the year, in weeks of seven. Read left to right,
  // it says how long the run is and how far it is from the record.
  const ROW_Y = 44, LAMP_Y = ROW_Y - 3.8;
  const MONO = "ui-monospace,SFMono-Regular,Menlo,monospace";
  const label = `${sk.current} day streak`;
  const x0 = padL + label.length * 6.7 + 14;
  const record = sk.current > 0 && sk.current > sk.prevBest;   // a tie is not a record yet
  const slots = Math.max(sk.longest, sk.current + 1);
  const TRACK = 430;
  let pitch = 8.4, gap = 5;
  const want = (slots - 1) * pitch + Math.floor((slots - 1) / 7) * gap;
  if (want > TRACK) { pitch *= TRACK / want; gap *= TRACK / want; }
  const lx = (i) => x0 + i * pitch + Math.floor(i / 7) * gap;
  let lamps;
  if (pitch >= 3.4) {
    const wire = `<line x1="${x0.toFixed(1)}" y1="${LAMP_Y}" x2="${lx(slots - 1).toFixed(1)}" y2="${LAMP_Y}" stroke="${P.rule}" stroke-width="1"/>` +
      (sk.current > 0 ? `<line x1="${x0.toFixed(1)}" y1="${LAMP_Y}" x2="${lx(sk.current).toFixed(1)}" y2="${LAMP_Y}" stroke="${P.gold}" stroke-width="1" stroke-opacity="0.35"/>` : "");
    lamps = wire + Array.from({ length: slots }, (_, i) => {
      const x = lx(i).toFixed(1);
      if (i < sk.current) return `<circle cx="${x}" cy="${LAMP_Y}" r="2.5" fill="${P.gold}" filter="url(#g)">${flash(i, "r", 2.5, 3.4)}</circle>`;
      if (i === sk.current) return `<circle cx="${x}" cy="${LAMP_Y}" r="3.3" fill="none" stroke="${P.gold}" stroke-width="1" opacity="0.9"/>` + ping(x, LAMP_Y, 3.3, 8);
      return `<circle cx="${x}" cy="${LAMP_Y}" r="1.3" fill="${P.faint}"/>`;
    }).join("\n");
  } else {
    // Too many days for single lamps: a lit bar, the open ring, then the unlit rest of the track.
    const xe = lx(slots - 1).toFixed(1), xc = lx(sk.current).toFixed(1);
    lamps = `<line x1="${x0.toFixed(1)}" y1="${LAMP_Y}" x2="${xe}" y2="${LAMP_Y}" stroke="${P.faint}" stroke-width="1.6" stroke-linecap="round"/>` +
      // (no blur filter here: a horizontal line has a zero-height box, which clips the filter away)
      (sk.current ? `<line x1="${x0.toFixed(1)}" y1="${LAMP_Y}" x2="${lx(sk.current - 1).toFixed(1)}" y2="${LAMP_Y}" stroke="${P.gold}" stroke-width="6" stroke-opacity="0.18" stroke-linecap="round"/>` +
        `<line x1="${x0.toFixed(1)}" y1="${LAMP_Y}" x2="${lx(sk.current - 1).toFixed(1)}" y2="${LAMP_Y}" stroke="${P.gold}" stroke-width="2.4" stroke-linecap="round"/>` : "") +
      `<circle cx="${xc}" cy="${LAMP_Y}" r="3" fill="${P.bg}" stroke="${P.gold}" stroke-width="1"/>` + ping(xc, LAMP_Y, 3, 7.5);
  }
  // A run that is setting the record marks the old best on the track.
  const bx = record && sk.prevBest > 0 ? (lx(sk.prevBest - 1) + pitch / 2).toFixed(1) : null;
  const passed = bx ? `<line x1="${bx}" y1="${LAMP_Y - 6}" x2="${bx}" y2="${LAMP_Y + 6}" stroke="${P.muted}" stroke-width="1"/>` : "";
  const tail = record
    ? `longest of the year${sk.prevBest ? ` · previous best ${sk.prevBest}` : ""}`
    : `longest ${sk.longest}${sk.longestEnd ? ` · ended ${sk.longestEnd}` : ""}`;
  const rowSvg =
    `<text x="${padL}" y="${ROW_Y}" fill="${P.ink}" font-size="11" font-family="${MONO}">${label}</text>\n` +
    `${lamps}\n${passed}` +
    `<text x="${(lx(slots - 1) + 12).toFixed(1)}" y="${ROW_Y}" fill="${P.muted}" font-size="11" font-family="${MONO}">${tail}</text>`;

  const starSvg = stars.map((s) => {
    const t = tone(s.n);
    const i = order.get(s.date);
    let tw = "";
    if (i !== undefined) {
      // Gold marks the current streak here and on the streak card: same colour, same meaning.
      // These stars skip the twinkle and flash in date order, on the clock the lamps share.
      t.c = P.gold; t.glow = true; t.r = Math.max(t.r, 2.4);
      tw = flash(i, "r", t.r, +(t.r + 1.4).toFixed(1));
    } else if (t.glow) {
      // Bright stars twinkle on their own clock, seeded by date so it never looks synchronized.
      tw = `<animate attributeName="opacity" values="1;0.45;1" dur="${(2.6 + hash(s.date + "t") * 2.4).toFixed(2)}s" begin="-${(hash(s.date + "d") * 4).toFixed(2)}s" repeatCount="indefinite"/>`;
    }
    return `<circle cx="${s.x.toFixed(1)}" cy="${s.y.toFixed(1)}" r="${t.r}" fill="${t.c}"${t.glow ? ' filter="url(#g)"' : ""}><title>${s.date} · ${s.n}</title>${tw}</circle>`;
  }).join("\n");

  const tickSvg = ticks.map((t) =>
    `<line x1="${t.x.toFixed(1)}" y1="${H - padB + 6}" x2="${t.x.toFixed(1)}" y2="${H - padB + 12}" stroke="${P.faint}" stroke-width="1"/>` +
    `<text x="${t.x.toFixed(1)}" y="${H - padB + 26}" fill="${P.muted}" font-size="10" font-family="ui-monospace,SFMono-Regular,Menlo,monospace">${t.label}</text>`
  ).join("\n");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Contribution constellation, last 12 months">
<defs>
  <filter id="g" x="-200%" y="-200%" width="500%" height="500%">
    <feGaussianBlur stdDeviation="1.6" result="b"/>
    <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>
  <filter id="halo" x="-100%" y="-100%" width="300%" height="300%">
    <feGaussianBlur stdDeviation="2.6"/>
  </filter>
</defs>
<rect width="${W}" height="${H}" fill="${P.bg}"/>
<line x1="${padL}" y1="${H - padB}" x2="${W - padR}" y2="${H - padB}" stroke="${P.rule}" stroke-width="1"/>
<polyline points="${poly}" fill="none" stroke="${P.soft}" stroke-width="2.6" stroke-opacity="0.16" stroke-linejoin="round" stroke-linecap="round" filter="url(#g)"/>
<polyline points="${poly}" fill="none" stroke="${P.soft}" stroke-width="1.1" stroke-opacity="0.85" stroke-linejoin="round" stroke-linecap="round"/>
<polyline points="${poly}" fill="none" stroke="${P.ink}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round" stroke-dasharray="90 ${plen}" stroke-dashoffset="${plen + 90}" filter="url(#g)">
  <animate attributeName="stroke-dashoffset" from="${plen + 90}" to="-90" dur="7s" repeatCount="indefinite"/>
</polyline>
${nodeSvg}
${haloSvg}
${starSvg}
${ringSvg}
${tickSvg}
<text x="${padL}" y="22" fill="${P.muted}" font-size="11" font-family="ui-monospace,SFMono-Regular,Menlo,monospace" letter-spacing="0.08em">contributions · last 12 months</text>
<text x="${W - padR}" y="22" text-anchor="end" fill="${P.ink}" font-size="11" font-family="ui-monospace,SFMono-Regular,Menlo,monospace">${cal.totalContributions} total · ${active} active days · peak ${peak.n} on ${peak.date}</text>
${rowSvg}
<text x="${W - padR}" y="${ROW_Y}" text-anchor="end" fill="${P.muted}" font-size="10" font-family="ui-monospace,SFMono-Regular,Menlo,monospace">updated ${today}</text>
</svg>`;
}

async function main() {
  let cal;
  if (process.env.SAMPLE) {
    // Offline preview: synthetic year with a believable shape.
    const weeks = [];
    const start = new Date(Date.UTC(2025, 8, 7));
    for (let w = 0; w < 53; w++) {
      const days = [];
      for (let d = 0; d < 7; d++) {
        const dt = new Date(start.getTime() + (w * 7 + d) * 86400000);
        const iso = dt.toISOString().slice(0, 10);
        const season = w > 22 && w < 44 ? 1 : 0.35;           // heavier while shipping The Pitch
        const wk = d === 0 || d === 6 ? 0.5 : 1;
        const r = hash(iso);
        const n = r < 0.28 ? 0 : Math.round(Math.pow(r, 0.6) * 14 * season * wk);
        days.push({ contributionCount: n, date: iso, weekday: d });
      }
      weeks.push({ contributionDays: days });
    }
    const total = weeks.flatMap((w) => w.contributionDays).reduce((a, b) => a + b.contributionCount, 0);
    cal = { totalContributions: total, weeks };
  } else {
    cal = await fetchCalendar();
  }
  const today = process.env.SAMPLE ? "2026-09-06" : new Date().toISOString().slice(0, 10);
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, render(cal, today));
  console.log("wrote", OUT, "total", cal.totalContributions);
}

if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });
module.exports = { render, streaks };
