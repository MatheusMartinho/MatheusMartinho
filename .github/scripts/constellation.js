// Renders assets/constellation.svg from the GitHub contribution calendar.
// Zero dependencies. Runs in a GitHub Action with the built-in GITHUB_TOKEN.

const fs = require("fs");
const path = require("path");

const LOGIN = process.env.GH_LOGIN || "MatheusMartinho";
const TOKEN = process.env.GITHUB_TOKEN;
const OUT = process.env.OUT || path.join(__dirname, "..", "assets", "constellation.svg");

// Palette mirrors the README: #0D1117 ground, #EDEDED ink, #8B949E muted, #21262D rule.
const P = {
  bg: "#0D1117",
  rule: "#21262D",
  faint: "#30363D",
  muted: "#8B949E",
  soft: "#C9D1D9",
  ink: "#EDEDED",
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

function render(cal) {
  const weeks = cal.weeks;
  const W = 1000, H = 280;
  const padL = 28, padR = 28, padT = 46, padB = 44;
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

  const starSvg = stars.map((s) => {
    const t = tone(s.n);
    // Bright stars twinkle on their own clock, seeded by date so it never looks synchronized.
    const tw = t.glow
      ? `<animate attributeName="opacity" values="1;0.45;1" dur="${(2.6 + hash(s.date + "t") * 2.4).toFixed(2)}s" begin="-${(hash(s.date + "d") * 4).toFixed(2)}s" repeatCount="indefinite"/>`
      : "";
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
</defs>
<rect width="${W}" height="${H}" fill="${P.bg}"/>
<line x1="${padL}" y1="${H - padB}" x2="${W - padR}" y2="${H - padB}" stroke="${P.rule}" stroke-width="1"/>
<polyline points="${poly}" fill="none" stroke="${P.soft}" stroke-width="2.6" stroke-opacity="0.16" stroke-linejoin="round" stroke-linecap="round" filter="url(#g)"/>
<polyline points="${poly}" fill="none" stroke="${P.soft}" stroke-width="1.1" stroke-opacity="0.85" stroke-linejoin="round" stroke-linecap="round"/>
<polyline points="${poly}" fill="none" stroke="${P.ink}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round" stroke-dasharray="90 ${plen}" stroke-dashoffset="${plen + 90}" filter="url(#g)">
  <animate attributeName="stroke-dashoffset" from="${plen + 90}" to="-90" dur="7s" repeatCount="indefinite"/>
</polyline>
${nodeSvg}
${starSvg}
${tickSvg}
<text x="${padL}" y="24" fill="${P.muted}" font-size="11" font-family="ui-monospace,SFMono-Regular,Menlo,monospace" letter-spacing="0.08em">contributions · last 12 months</text>
<text x="${W - padR}" y="24" text-anchor="end" fill="${P.ink}" font-size="11" font-family="ui-monospace,SFMono-Regular,Menlo,monospace">${cal.totalContributions} total · ${active} active days · peak ${peak.n} on ${peak.date}</text>
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
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, render(cal));
  console.log("wrote", OUT, "total", cal.totalContributions);
}

main().catch((e) => { console.error(e); process.exit(1); });
