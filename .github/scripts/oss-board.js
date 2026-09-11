// Renders assets/oss-board.svg — a split-flap "departures" board of upstream
// pull requests. Each PR is a flight leaving this desk for someone else's repo.
//
// Data lives in assets/oss.json (display order). Run: node .github/scripts/oss-board.js
//
// Rendered by GitHub inside <img>, so: no CSS animation, no web fonts, no links.
// SMIL only. Every animated attribute is authored in its final state and animated
// *from* the start state, so a renderer without SMIL shows the settled board.

const fs = require("fs");
const path = require("path");

const DATA = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "..", "assets", "oss.json"), "utf8"));
const OUT = path.join(__dirname, "..", "..", "assets", "oss-board.svg");

const P = { bg: "#0D1117", ink: "#EDEDED", muted: "#8B949E", dim: "#484F58", flapTop: "#1B222C", flapBot: "#141A22", gold: "#FFD98A" };
const SANS = "-apple-system,'Segoe UI',Helvetica,Arial,sans-serif";
const MONO = "ui-monospace,'SF Mono',Menlo,Consolas,'Liberation Mono',monospace";

const W = 940;
const ROW = 28, CELL_H = 24, ROW0 = 104;
// Cells: [x, width]. Mono at 12px is ≤ 7.7px/char across SF Mono/Menlo/Consolas; padding 10px each side.
const COLS = [
  { key: "pr", x: 36, w: 106, max: 11 },
  { key: "dest", x: 148, w: 292, max: 36 },
  { key: "what", x: 446, w: 368, max: 45 },
  { key: "status", x: 820, w: 84, max: 9 },
];
const H = ROW0 + DATA.length * ROW + 44;

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const f = (n) => Number(n.toFixed(3));

// Deterministic scramble so the SVG is stable between runs.
function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#/-";
function scramble(text, r) {
  return [...text].map((c) => (c === " " || c === "·" ? c : GLYPHS[Math.floor(r() * GLYPHS.length)])).join("");
}
const clampLen = (s, n) => (s.length <= n ? s : s.slice(0, n - 1) + "…");

// Three layers per cell: two scrambles (base hidden, flashed in sequence) and the
// final text (base visible, hidden until it "lands"). Hard cuts = flaps.
function flapText(x, y, text, attrs, t0, r, reflip) {
  const a = t0, b = t0 + 0.13, c = t0 + 0.26, dur = c + 0.02;
  const k = (t) => f(t / dur);
  const s1 = esc(scramble(text, r)), s2 = esc(scramble(text, r)), fin = esc(text);
  let out = "";
  out += `<text x="${x}" y="${y}" ${attrs} opacity="0">${s1}<animate attributeName="opacity" values="0;1;0;0" keyTimes="0;${k(a)};${k(b)};1" dur="${dur}s" calcMode="discrete"/>`;
  if (reflip) out += `<animate attributeName="opacity" values="1;0;0" keyTimes="0;0.012;1" dur="${reflip.period}s" begin="${reflip.begin}s" calcMode="discrete" repeatCount="indefinite"/>`;
  out += `</text>`;
  out += `<text x="${x}" y="${y}" ${attrs} opacity="0">${s2}<animate attributeName="opacity" values="0;1;0;0" keyTimes="0;${k(b)};${k(c)};1" dur="${dur}s" calcMode="discrete"/>`;
  if (reflip) out += `<animate attributeName="opacity" values="0;1;0;0" keyTimes="0;0.012;0.024;1" dur="${reflip.period}s" begin="${reflip.begin}s" calcMode="discrete" repeatCount="indefinite"/>`;
  out += `</text>`;
  out += `<text x="${x}" y="${y}" ${attrs}>${fin}<animate attributeName="opacity" values="0;1" keyTimes="0;${k(c)}" dur="${dur}s" calcMode="discrete" fill="freeze"/>`;
  if (reflip) out += `<animate attributeName="opacity" values="0;1;1" keyTimes="0;0.024;1" dur="${reflip.period}s" begin="${reflip.begin}s" calcMode="discrete" repeatCount="indefinite"/>`;
  out += `</text>`;
  return out;
}

function cell(col, y) {
  const mid = y + CELL_H / 2;
  return `<rect x="${col.x}" y="${y}" width="${col.w}" height="${CELL_H / 2}" fill="${P.flapTop}"/>` +
    `<rect x="${col.x}" y="${mid}" width="${col.w}" height="${CELL_H / 2}" fill="${P.flapBot}"/>` +
    `<rect x="${col.x + 0.5}" y="${y + 0.5}" width="${col.w - 1}" height="${CELL_H - 1}" rx="3" fill="none" stroke="${P.ink}" stroke-opacity="0.06"/>`;
}

function render() {
  const merged = DATA.filter((d) => d.status === "merged").length;
  const projects = new Set(DATA.map((d) => d.org)).size;
  const r = rng(20260911);
  const rows = [];
  const hinges = [];
  const cells = [];

  DATA.forEach((d, i) => {
    const y = ROW0 + i * ROW;
    const base = y + 16.5;
    const t0 = 0.3 + i * 0.11;
    const mono = `font-family="${MONO}" font-size="12" letter-spacing="0.4"`;
    const reflip = { begin: 6 + i * 1.3, period: 24 + (i % 5) * 2 };

    COLS.forEach((c) => cells.push(cell(c, y)));
    hinges.push(`<line x1="36" y1="${y + CELL_H / 2}" x2="904" y2="${y + CELL_H / 2}" stroke="${P.bg}" stroke-width="1.2"/>`);

    // PR number
    rows.push(flapText(COLS[0].x + 10, base, clampLen(d.pr, COLS[0].max), `${mono} fill="${P.muted}"`, t0, r));
    // Destination: ORG / repo — org bright, repo muted, one flowing text so widths never collide
    const dest = clampLen(`${d.org} / ${d.repo}`.toUpperCase(), COLS[1].max);
    const orgLen = Math.min(d.org.length, dest.length);
    const destAttrs = `${mono} fill="${P.ink}" font-weight="700"`;
    rows.push(flapTextDest(COLS[1].x + 10, base, dest, orgLen, destAttrs, t0 + 0.06, r));
    // Remarks
    rows.push(flapText(COLS[2].x + 10, base, clampLen(d.what.toUpperCase(), COLS[2].max), `${mono} fill="${P.ink}"`, t0 + 0.12, r, reflip));
    // Status: marker + word
    const isM = d.status === "merged";
    const sx = COLS[3].x + 12;
    const marker = isM
      ? `<circle cx="${sx}" cy="${base - 4}" r="3" fill="${P.gold}"><animate attributeName="opacity" values="0;1" keyTimes="0;0.98" dur="${f(t0 + 0.46)}s" calcMode="discrete" fill="freeze"/></circle>`
      : `<circle cx="${sx}" cy="${base - 4}" r="2.6" fill="none" stroke="${P.muted}" stroke-width="1.2"><animate attributeName="opacity" values="0;1" keyTimes="0;0.98" dur="${f(t0 + 0.46)}s" calcMode="discrete" fill="freeze"/><animate attributeName="stroke-opacity" values="1;0.35;1" dur="2.6s" begin="${f(3 + i * 0.2)}s" repeatCount="indefinite"/></circle>`;
    rows.push(marker);
    rows.push(flapText(sx + 10, base, isM ? "MERGED" : "OPEN", `${mono} fill="${isM ? P.gold : P.muted}" font-weight="700"`, t0 + 0.18, r));
  });

  const headY = 84;
  const colHead = (c, label) => `<text x="${c.x + 10}" y="${headY}" font-family="${SANS}" font-size="9" font-weight="600" letter-spacing="2" fill="${P.muted}" opacity="0.7">${label}</text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Open source departures board: ${DATA.length} pull requests to ${projects} projects, ${merged} merged">
<defs>
  <clipPath id="frame"><rect width="${W}" height="${H}" rx="20"/></clipPath>
  ${COLS.map((c, i) => `<clipPath id="col${i}"><rect x="${c.x}" y="${ROW0 - 2}" width="${c.w}" height="${DATA.length * ROW + 4}"/></clipPath>`).join("\n  ")}
  <radialGradient id="boardGlow" cx="50%" cy="0%" r="80%"><stop offset="0%" stop-color="${P.ink}" stop-opacity="0.05"/><stop offset="100%" stop-color="${P.ink}" stop-opacity="0"/></radialGradient>
</defs>
<g clip-path="url(#frame)">
  <rect width="${W}" height="${H}" fill="${P.bg}"/>
  <rect width="${W}" height="${H}" fill="url(#boardGlow)"/>
</g>

<text x="36" y="40" font-family="${SANS}" font-size="10" font-weight="600" letter-spacing="3" fill="${P.muted}">OPEN SOURCE</text>
<text x="36" y="62" font-family="${SANS}" font-size="17" font-weight="700" letter-spacing="4" fill="${P.ink}">DEPARTURES</text>
<text x="904" y="40" text-anchor="end" font-family="${SANS}" font-size="10" letter-spacing="2" fill="${P.muted}">${DATA.length} PRS · ${projects} PROJECTS · ${merged} MERGED</text>
<g>
  <rect x="893" y="52" width="11" height="11" rx="2" fill="${P.gold}"><animate attributeName="opacity" values="1;0.25;1" dur="1.6s" repeatCount="indefinite"/></rect>
  <text x="883" y="62" text-anchor="end" font-family="${SANS}" font-size="9.5" letter-spacing="1.5" fill="${P.muted}">NOW BOARDING</text>
</g>

${colHead(COLS[0], "PR")}
${colHead(COLS[1], "DESTINATION")}
${colHead(COLS[2], "REMARKS")}
${colHead(COLS[3], "STATUS")}

${cells.join("\n")}
${hinges.join("\n")}
<g clip-path="url(#col0)"></g>
${rows.join("\n")}

<text x="36" y="${H - 18}" font-family="${SANS}" font-size="9.5" letter-spacing="1" fill="${P.dim}">real bugs · real projects · real users on the other end</text>
<text x="904" y="${H - 18}" text-anchor="end" font-family="${SANS}" font-size="9.5" letter-spacing="1" fill="${P.dim}">gate: github.com/MatheusMartinho</text>
<rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="20" fill="none" stroke="${P.ink}" stroke-opacity="0.10"/>
</svg>
`;
}

// Destination cell: org bold + " / repo" muted inside one <text>, flapping as a unit.
function flapTextDest(x, y, dest, orgLen, attrs, t0, r) {
  const a = t0, b = t0 + 0.13, c = t0 + 0.26, dur = c + 0.02;
  const k = (t) => f(t / dur);
  const split = (s) => `${esc(s.slice(0, orgLen))}<tspan fill="${P.muted}" font-weight="400">${esc(s.slice(orgLen))}</tspan>`;
  const s1 = scramble(dest, r), s2 = scramble(dest, r);
  return `<text x="${x}" y="${y}" ${attrs} opacity="0">${split(s1)}<animate attributeName="opacity" values="0;1;0;0" keyTimes="0;${k(a)};${k(b)};1" dur="${dur}s" calcMode="discrete"/></text>` +
    `<text x="${x}" y="${y}" ${attrs} opacity="0">${split(s2)}<animate attributeName="opacity" values="0;1;0;0" keyTimes="0;${k(b)};${k(c)};1" dur="${dur}s" calcMode="discrete"/></text>` +
    `<text x="${x}" y="${y}" ${attrs}>${split(dest)}<animate attributeName="opacity" values="0;1" keyTimes="0;${k(c)}" dur="${dur}s" calcMode="discrete" fill="freeze"/></text>`;
}

fs.writeFileSync(OUT, render());
console.log(`wrote ${path.relative(process.cwd(), OUT)} — ${DATA.length} rows, ${fs.statSync(OUT).size} bytes`);
