// Renders assets/streak.svg — a boarding pass for the contribution streak.
// Zero dependencies. Runs in a GitHub Action with the built-in GITHUB_TOKEN.
//
// Rendered by GitHub inside <img>, so: no CSS animation, no web fonts, no links.
// SMIL only. Every animated attribute is authored in its final state and animated
// *from* the start state, so a renderer without SMIL shows the settled card.
//
// Offline preview: SAMPLE=1 node .github/scripts/streak.js

const fs = require("fs");
const path = require("path");

const LOGIN = process.env.GH_LOGIN || "MatheusMartinho";
// GH_PAT (optional) sees private contributions even when the profile hides them; GITHUB_TOKEN otherwise.
const TOKEN = process.env.GH_PAT || process.env.GITHUB_TOKEN;
const OUT = process.env.OUT || path.join(__dirname, "..", "..", "assets", "streak.svg");

// Palette mirrors the README: #0D1117 ground, #EDEDED ink, #8B949E muted, #21262D rule. Gold from the departures board.
const P = { bg: "#0D1117", ink: "#EDEDED", soft: "#C9D1D9", muted: "#8B949E", dim: "#484F58", rule: "#21262D", gold: "#FFD98A" };
const SANS = "-apple-system,'Segoe UI',Helvetica,Arial,sans-serif";
const MONO = "ui-monospace,'SF Mono',Menlo,Consolas,'Liberation Mono',monospace";

const W = 495, H = 195, R = 14;
const STUB_X = 352;            // perforation
const DAYS = 91;               // barcode window: 13 weeks

const f = (n) => Number(n.toFixed(2));
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const fmt = (n) => n.toLocaleString("en-US");
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const mon = (iso) => MONTHS[Number(iso.slice(5, 7)) - 1];
const day = (iso) => Number(iso.slice(8, 10));
const short = (iso) => `${mon(iso)} ${day(iso)}`;                         // sep 14
const shortY = (iso) => `${mon(iso)} ${day(iso)}, ${iso.slice(0, 4)}`;    // dec 19, 2025
const addDays = (iso, n) => new Date(Date.parse(iso + "T00:00:00Z") + n * 86400000).toISOString().slice(0, 10);

async function gql(query, variables) {
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: { Authorization: `bearer ${TOKEN}`, "Content-Type": "application/json", "User-Agent": "streak" },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  return json.data;
}

// Every day since the account was created. GitHub caps one collection at a year, so walk year by year.
async function fetchAllDays() {
  if (!TOKEN) throw new Error("GITHUB_TOKEN missing");
  const { user } = await gql(`query($login:String!){ user(login:$login){ createdAt } }`, { login: LOGIN });
  const created = user.createdAt.slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  const days = [];
  for (let y = Number(created.slice(0, 4)); y <= Number(today.slice(0, 4)); y++) {
    const from = y === Number(created.slice(0, 4)) ? created : `${y}-01-01`;
    const to = y === Number(today.slice(0, 4)) ? today : `${y}-12-31`;
    const data = await gql(
      `query($login:String!,$from:DateTime!,$to:DateTime!){
        user(login:$login){ contributionsCollection(from:$from,to:$to){
          contributionCalendar{ weeks{ contributionDays{ contributionCount date } } } } } }`,
      { login: LOGIN, from: `${from}T00:00:00Z`, to: `${to}T23:59:59Z` }
    );
    for (const w of data.user.contributionsCollection.contributionCalendar.weeks)
      for (const d of w.contributionDays) if (d.date >= from && d.date <= to) days.push({ date: d.date, n: d.contributionCount });
  }
  days.sort((a, b) => a.date.localeCompare(b.date));
  return { days, created, today };
}

function sampleDays() {
  // Offline preview: seven years with a believable shape and a long run last winter.
  const created = "2019-08-07", today = "2026-09-15";
  const days = [];
  let h = 2166136261;
  const rnd = (s) => { for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967295; };
  for (let d = created; d <= today; d = addDays(d, 1)) {
    const r = rnd(d);
    const inRun = d >= "2025-11-10" && d <= "2025-12-19";
    const recent = d >= "2026-06-01";
    const n = inRun ? 1 + Math.floor(r * 9) : r < (recent ? 0.45 : 0.62) ? 0 : Math.floor(Math.pow(r, 0.5) * 12);
    days.push({ date: d, n });
  }
  // A quiet stretch right before today, then a fresh one-day streak, like the real card this week.
  for (const x of days) if (x.date >= "2026-09-11" && x.date <= "2026-09-13") x.n = 0;
  days.find((x) => x.date === "2026-09-14").n = 3;
  days.find((x) => x.date === "2026-09-15").n = 0;
  return { days, created, today };
}

// Current streak (a quiet today does not break it yet) and the longest run ever.
function stats(days, today) {
  const total = days.reduce((a, d) => a + d.n, 0);
  let longest = { len: 0, start: null, end: null }, run = 0, runStart = null;
  for (const d of days) {
    if (d.n > 0) { if (run === 0) runStart = d.date; run++; if (run > longest.len) longest = { len: run, start: runStart, end: d.date }; }
    else run = 0;
  }
  let i = days.length - 1;
  if (i >= 0 && days[i].date === today && days[i].n === 0) i--;
  const streak = [];
  for (; i >= 0 && days[i].n > 0; i--) streak.unshift(days[i].date);
  return { total, longest, current: streak.length, streakStart: streak[0] || null, streakDays: new Set(streak) };
}

function render({ days, created, today }) {
  const s = stats(days, today);
  const byDate = new Map(days.map((d) => [d.date, d.n]));

  // ---- barcode: the last DAYS days, one bar each, height by count, the streak in gold
  const bx0 = 30, bx1 = STUB_X - 26, by = 148, bh = 38;
  const step = (bx1 - bx0) / DAYS, bw = step * 0.62;
  const from = addDays(today, -(DAYS - 1));
  const maxN = Math.max(1, ...Array.from({ length: DAYS }, (_, i) => byDate.get(addDays(from, i)) || 0));
  const bars = [], ticks = [];
  for (let i = 0; i < DAYS; i++) {
    const date = addDays(from, i), n = byDate.get(date) || 0;
    const x = f(bx0 + i * step);
    const h = n === 0 ? 2 : f(6 + (bh - 6) * Math.log1p(n) / Math.log1p(maxN));
    const inStreak = s.streakDays.has(date);
    const color = inStreak ? P.gold : n === 0 ? P.rule : n <= 2 ? P.dim : n <= 8 ? P.muted : P.soft;
    const t0 = f(0.25 + i * 0.012);
    bars.push(
      `<rect x="${x}" y="${f(by - h)}" width="${f(bw)}" height="${h}" fill="${color}"${inStreak ? ' filter="url(#gg)"' : ""}>` +
      `<title>${date} · ${n}</title>` +
      `<animate attributeName="height" from="2" to="${h}" dur="0.5s" begin="${t0}s" fill="freeze" calcMode="spline" keySplines="0.2 0.8 0.2 1"/>` +
      `<animate attributeName="y" from="${by - 2}" to="${f(by - h)}" dur="0.5s" begin="${t0}s" fill="freeze" calcMode="spline" keySplines="0.2 0.8 0.2 1"/>` +
      `</rect>`
    );
    if (day(date) === 1 || i === 0) ticks.push({ x, label: mon(date) });
  }
  // The first tick often owns a sliver; drop it if a real month start follows too closely.
  if (ticks.length > 1 && ticks[1].x - ticks[0].x < step * 10) ticks.shift();
  const tickSvg = ticks.map((t) =>
    `<line x1="${t.x}" y1="${by + 5}" x2="${t.x}" y2="${by + 9}" stroke="${P.dim}" stroke-width="1"/>` +
    `<text x="${t.x}" y="${by + 19}" fill="${P.muted}" font-size="9" font-family="${MONO}">${t.label}</text>`
  ).join("\n");

  // ---- current streak, the headline
  const unit = s.current === 1 ? "day" : "days";
  const since = s.current > 0
    ? `current · since ${short(s.streakStart)}`
    : `quiet today · last run ended ${s.longest.end ? short(s.longest.end) : "—"}`;
  const bigW = String(s.current).length * 27;   // 46px mono digits ≈ 27px each, to place the unit

  // ---- stub
  const sx = STUB_X + 22;
  const stub = `
<text x="${sx}" y="52" font-family="${SANS}" font-size="9" font-weight="600" letter-spacing="2.5" fill="${P.muted}">TOTAL</text>
<text x="${sx}" y="78" font-family="${MONO}" font-size="24" font-weight="700" fill="${P.ink}">${fmt(s.total)}</text>
<text x="${sx}" y="93" font-family="${MONO}" font-size="9.5" fill="${P.muted}">contributions</text>
<text x="${sx}" y="118" font-family="${SANS}" font-size="9" font-weight="600" letter-spacing="2.5" fill="${P.muted}">LONGEST</text>
<text x="${sx}" y="144" font-family="${MONO}" font-size="24" font-weight="700" fill="${P.ink}">${s.longest.len}<tspan font-size="11" font-weight="400" fill="${P.muted}"> days</tspan></text>
<text x="${sx}" y="157" font-family="${MONO}" font-size="9.5" fill="${P.muted}">${s.longest.start ? `${short(s.longest.start)} → ${short(s.longest.end)}` : "—"}</text>
<text x="${sx}" y="168" font-family="${MONO}" font-size="9.5" fill="${P.dim}">${s.longest.end ? s.longest.end.slice(0, 4) : ""}</text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="GitHub streak: ${s.current} ${unit} current, ${s.longest.len} days longest, ${fmt(s.total)} contributions since ${shortY(created)}">
<defs>
  <radialGradient id="st-glow" cx="0%" cy="0%" r="70%"><stop offset="0%" stop-color="#EDEDED" stop-opacity="0.05"/><stop offset="100%" stop-color="#EDEDED" stop-opacity="0"/></radialGradient>
  <clipPath id="st-frame"><rect width="${W}" height="${H}" rx="${R}"/></clipPath>
  <filter id="gg" x="-100%" y="-50%" width="300%" height="200%"><feGaussianBlur stdDeviation="1.4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  <filter id="gbig" x="-20%" y="-30%" width="140%" height="160%"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
</defs>
<g clip-path="url(#st-frame)">
  <rect width="${W}" height="${H}" fill="${P.bg}"/>
  <rect width="${W}" height="${H}" fill="url(#st-glow)"/>
  <!-- perforation: the stub tears off here -->
  <line x1="${STUB_X}" y1="12" x2="${STUB_X}" y2="${H - 12}" stroke="${P.rule}" stroke-width="1.2" stroke-dasharray="3 4"/>
  <circle cx="${STUB_X}" cy="0" r="7" fill="#161B22"/>
  <circle cx="${STUB_X}" cy="${H}" r="7" fill="#161B22"/>
</g>

<!-- header -->
<rect x="30" y="19" width="3" height="13" fill="${P.ink}"/>
<text x="40" y="30" font-family="${SANS}" font-size="10" font-weight="600" letter-spacing="3" fill="${P.muted}">STREAK</text>
<text x="${STUB_X - 22}" y="30" text-anchor="end" font-family="${SANS}" font-size="9" letter-spacing="2" fill="${P.muted}">GITHUB · SINCE ${mon(created).toUpperCase()} ${created.slice(0, 4)}</text>

<!-- headline -->
<text x="30" y="80" font-family="${MONO}" font-size="46" font-weight="700" fill="${P.gold}" filter="url(#gbig)">${s.current}<animate attributeName="opacity" from="0" to="1" dur="0.6s" begin="0.1s" fill="freeze"/></text>
<text x="${30 + bigW + 8}" y="80" font-family="${MONO}" font-size="15" fill="${P.muted}">${unit}</text>
<text x="30" y="98" font-family="${MONO}" font-size="10.5" fill="${P.muted}">${esc(since)}</text>

<!-- barcode: last ${DAYS} days -->
${bars.join("\n")}
<line x1="${bx0}" y1="${by + 0.5}" x2="${f(bx1)}" y2="${by + 0.5}" stroke="${P.rule}" stroke-width="1"/>
${tickSvg}

<!-- stub -->
${stub}

<!-- footer -->
<text x="30" y="${H - 13}" font-family="${SANS}" font-size="9.5" fill="${P.dim}">consecutive days with a contribution · last ${DAYS} days</text>
<text x="${W - 24}" y="${H - 13}" text-anchor="end" font-family="${SANS}" font-size="9.5" fill="${P.dim}">updated ${today}</text>
</svg>
`;
}

async function main() {
  const data = process.env.SAMPLE ? sampleDays() : await fetchAllDays();
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, render(data));
  const s = stats(data.days, data.today);
  console.log("wrote", OUT, "· current", s.current, "· longest", s.longest.len, "· total", s.total);
}

main().catch((e) => { console.error(e); process.exit(1); });
