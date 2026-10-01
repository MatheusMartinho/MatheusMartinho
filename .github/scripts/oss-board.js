// Renders assets/oss-board.svg — the open source ledger: every upstream pull
// request, where it went and where it stands.
//
// Data lives in assets/oss.json (display order). Run: node .github/scripts/oss-board.js
//
// Rendered by GitHub inside <img>: no web fonts, no links, SMIL only. Every
// animated attribute is authored in its final state and animated *from* the
// start state, so a renderer without SMIL shows the finished ledger.

const fs = require("fs");
const path = require("path");

const DATA = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "..", "assets", "oss.json"), "utf8"));
const OUT = path.join(__dirname, "..", "..", "assets", "oss-board.svg");

const P = { bg: "#0D1117", ink: "#EDEDED", soft: "#C9D1D9", muted: "#8B949E", dim: "#484F58", rule: "#21262D", edge: "#30363D", gold: "#FFD98A" };
const SANS = "-apple-system,'Segoe UI',Helvetica,Arial,sans-serif";
const MONO = "ui-monospace,'SF Mono',Menlo,Consolas,'Liberation Mono',monospace";

const W = 940;
const PAD = 30;
const ROW = 28;
const TABLE_Y = 196;
const H = TABLE_Y + DATA.length * ROW + 52;
const COL = { status: PAD, project: 136, change: 400, pr: W - PAD };

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const f = (n) => Number(n.toFixed(3));
const clampLen = (s, n) => (s.length <= n ? s : s.slice(0, n - 1) + "…");

/** Final value authored; animate from `from` after `delay` (no flash without SMIL). */
function fadeIn(delay, dur = 0.5) {
  const total = delay + dur;
  return `<animate attributeName="opacity" values="0;0;1" keyTimes="0;${f(delay / total)};1" dur="${f(total)}s" fill="freeze"/>`;
}

function pill(x, y, merged, i) {
  if (merged) {
    return `<rect x="${x}" y="${y - 13}" width="70" height="19" rx="9.5" fill="${P.gold}" fill-opacity="0.12" stroke="${P.gold}" stroke-opacity="0.45"/>` +
      `<circle cx="${x + 12}" cy="${y - 3.5}" r="2.6" fill="${P.gold}"/>` +
      `<text x="${x + 21}" y="${y}" font-family="${MONO}" font-size="9.5" font-weight="700" letter-spacing="1.2" fill="${P.gold}">MERGED</text>`;
  }
  return `<rect x="${x}" y="${y - 13}" width="70" height="19" rx="9.5" fill="none" stroke="${P.edge}"/>` +
    `<circle cx="${x + 12}" cy="${y - 3.5}" r="2.6" fill="none" stroke="${P.muted}" stroke-width="1.2">` +
    `<animate attributeName="stroke-opacity" values="1;0.3;1" dur="2.8s" begin="${f(2 + (i % 7) * 0.3)}s" repeatCount="indefinite"/></circle>` +
    `<text x="${x + 21}" y="${y}" font-family="${MONO}" font-size="9.5" font-weight="700" letter-spacing="1.2" fill="${P.muted}">OPEN</text>`;
}

function stat(x, value, label, i) {
  return `<g>${fadeIn(0.1 + i * 0.1)}` +
    `<text x="${x}" y="114" font-family="${SANS}" font-size="38" font-weight="700" fill="${P.ink}">${value}</text>` +
    `<text x="${x + 1}" y="136" font-family="${MONO}" font-size="9.5" letter-spacing="2" fill="${P.muted}">${label}</text></g>`;
}

function ratioBar(x, w, merged, total) {
  const gap = 3;
  const seg = (w - gap * (total - 1)) / total;
  let out = `<text x="${x}" y="88" font-family="${MONO}" font-size="9.5" letter-spacing="2" fill="${P.muted}">MERGE RATE</text>` +
    `<text x="${x + w}" y="88" text-anchor="end" font-family="${MONO}" font-size="9.5" letter-spacing="1" fill="${P.muted}"><tspan fill="${P.gold}" font-weight="700">${merged}</tspan> / ${total}</text>`;
  for (let k = 0; k < total; k++) {
    const sx = x + k * (seg + gap);
    const on = k < merged;
    out += `<rect x="${f(sx)}" y="102" width="${f(seg)}" height="14" rx="2" fill="${on ? P.gold : P.rule}"${on ? "" : ` stroke="${P.edge}" stroke-width="0.6"`}>` +
      (on ? fadeIn(0.4 + k * 0.08, 0.3) : "") + `</rect>`;
  }
  out += `<text x="${x}" y="136" font-family="${SANS}" font-size="10.5" fill="${P.dim}">the rest are in review upstream</text>`;
  return out;
}

function render() {
  const merged = DATA.filter((d) => d.status === "merged").length;
  const projects = new Set(DATA.map((d) => d.org)).size;

  const head = (x, label, anchor = "start") =>
    `<text x="${x}" y="${TABLE_Y - 14}" text-anchor="${anchor}" font-family="${MONO}" font-size="9" letter-spacing="2" fill="${P.muted}" opacity="0.8">${label}</text>`;

  const rows = DATA.map((d, i) => {
    const y = TABLE_Y + i * ROW;
    const base = y + 18;
    const isM = d.status === "merged";
    const proj = `${esc(d.org)}<tspan fill="${P.muted}" font-weight="400"> / ${esc(d.repo)}</tspan>`;
    return `<g>${fadeIn(0.35 + i * 0.045, 0.4)}` +
      (i ? "" : `<line x1="${PAD}" y1="${y}" x2="${W - PAD}" y2="${y}" stroke="${P.rule}"/>`) +
      pill(COL.status, base, isM, i) +
      `<text x="${COL.project}" y="${base}" font-family="${SANS}" font-size="12.5" font-weight="600" fill="${P.ink}">${proj}</text>` +
      `<text x="${COL.change}" y="${base}" font-family="${SANS}" font-size="12.5" fill="${P.soft}">${esc(clampLen(d.what, 64))}</text>` +
      `<text x="${COL.pr}" y="${base}" text-anchor="end" font-family="${MONO}" font-size="11.5" fill="${P.muted}">${esc(d.pr)}</text>` +
      `<line x1="${PAD}" y1="${y + ROW}" x2="${W - PAD}" y2="${y + ROW}" stroke="${P.rule}"/>` +
      `</g>`;
  }).join("\n");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Open source ledger: ${DATA.length} pull requests to ${projects} projects, ${merged} merged">
<defs>
  <clipPath id="frame"><rect width="${W}" height="${H}" rx="20"/></clipPath>
  <radialGradient id="glow" cx="0%" cy="0%" r="70%"><stop offset="0%" stop-color="${P.gold}" stop-opacity="0.06"/><stop offset="100%" stop-color="${P.gold}" stop-opacity="0"/></radialGradient>
</defs>
<g clip-path="url(#frame)">
  <rect width="${W}" height="${H}" fill="${P.bg}"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>
</g>

<text x="${PAD}" y="40" font-family="${SANS}" font-size="10" font-weight="600" letter-spacing="3" fill="${P.muted}">OPEN SOURCE</text>
<text x="${W - PAD}" y="40" text-anchor="end" font-family="${SANS}" font-size="10" letter-spacing="2" fill="${P.muted}">UPSTREAM PULL REQUESTS</text>
<line x1="${PAD}" y1="56" x2="${W - PAD}" y2="56" stroke="${P.rule}"/>

${stat(PAD, DATA.length, "PULL REQUESTS", 0)}
${stat(PAD + 170, projects, "PROJECTS", 1)}
${stat(PAD + 320, merged, "MERGED", 2)}
${ratioBar(560, W - PAD - 560, merged, DATA.length)}

${head(COL.status, "STATUS")}
${head(COL.project, "PROJECT")}
${head(COL.change, "CHANGE")}
${head(COL.pr, "PR", "end")}
${rows}

<text x="${PAD}" y="${H - 20}" font-family="${SANS}" font-size="10" letter-spacing="0.5" fill="${P.dim}">real bugs · real projects · real users on the other end</text>
<text x="${W - PAD}" y="${H - 20}" text-anchor="end" font-family="${SANS}" font-size="10" letter-spacing="0.5" fill="${P.dim}">every PR, with links, below ↓</text>
<rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="20" fill="none" stroke="${P.ink}" stroke-opacity="0.08"/>
</svg>
`;
}

fs.writeFileSync(OUT, render());
console.log(`wrote ${path.relative(process.cwd(), OUT)} — ${DATA.length} rows, ${fs.statSync(OUT).size} bytes`);
