// Syncs assets/oss.json (and the "Every PR, with links" list in README.md) from
// the GitHub search API: every pull request I opened in someone else's repo.
//
// The API owns the facts (which PRs exist, open or merged). assets/oss-curated.json
// owns the words: display names, the short line on the board, the longer line in
// the README, and the repos that should never show up. A PR with no curated text
// uses its own title, cleaned up. Closed-without-merge PRs are left out.
//
// Zero dependencies. Runs in a GitHub Action with the built-in GITHUB_TOKEN.
// Then: node .github/scripts/oss-board.js renders the board from assets/oss.json.

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");
const LOGIN = process.env.GH_LOGIN || "MatheusMartinho";
const TOKEN = process.env.GITHUB_TOKEN;
const CUR = JSON.parse(fs.readFileSync(path.join(ROOT, "assets", "oss-curated.json"), "utf8"));
const OUT = path.join(ROOT, "assets", "oss.json");
const README = path.join(ROOT, "README.md");
const START = "<!-- oss:start -->", END = "<!-- oss:end -->";

async function searchAll() {
  const q = `type:pr author:${LOGIN} -user:${LOGIN}`;
  const items = [];
  for (let page = 1; page <= 10; page++) {
    const url = `https://api.github.com/search/issues?q=${encodeURIComponent(q)}&per_page=100&page=${page}`;
    const res = await fetch(url, {
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "oss-sync",
        ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
      },
    });
    if (!res.ok) throw new Error(`search failed: ${res.status} ${await res.text()}`);
    const body = await res.json();
    // A partial answer would drop real PRs from the board; better to keep yesterday's.
    if (body.incomplete_results) throw new Error("search returned incomplete results");
    items.push(...body.items);
    if (items.length >= body.total_count || body.items.length < 100) break;
  }
  return items;
}

// "fix(cli): load compiler options with jiti (fixes #12)" → "Load compiler options with jiti"
function cleanTitle(t) {
  let s = t.trim()
    .replace(/^\[[^\]]+\]\s*/g, "")
    .replace(/^[a-z]+(\([^)]*\))?!?:\s*/i, "")
    .replace(/\s*\((fixes|closes|resolves) #\d+\)\s*$/i, "");
  return s.charAt(0).toUpperCase() + s.slice(1);
}
const lowerFirst = (s) => s.charAt(0).toLowerCase() + s.slice(1);

function toEntry(item) {
  const [owner, repo] = item.repository_url.replace("https://api.github.com/repos/", "").split("/");
  const url = item.html_url;
  const merged = item.pull_request && item.pull_request.merged_at;
  const status = merged ? "merged" : item.state === "open" ? "open" : null;
  if (!status) return null;                                  // closed without merge
  if (owner.toLowerCase() === LOGIN.toLowerCase()) return null;
  if ((CUR.exclude || []).some((x) => x === `${owner}/${repo}` || x === url)) return null;
  const words = (CUR.prs || {})[url] || {};
  const what = words.board || cleanTitle(item.title);
  return {
    status,
    org: (CUR.owners || {})[owner] || owner,
    repo: (CUR.repos || {})[`${owner}/${repo}`] || repo,
    pr: `#${item.number}`,
    what,
    url,
    _readme: words.readme || lowerFirst(what),
    _at: merged || item.created_at,
  };
}

function readmeList(entries) {
  const line = (e) =>
    `- **${e.org}** \`${e.repo}\` — ${e._readme} · [${e.pr}](${e.url}) · ` +
    `<img src="./assets/${e.status}.svg" height="20" align="middle" alt="${e.status}" />`;
  const merged = entries.filter((e) => e.status === "merged").map(line);
  const open = entries.filter((e) => e.status === "open").map(line);
  return [START, "", "**Merged**", "", ...merged, "", "**Open**", "", ...open, "", END].join("\n");
}

async function main() {
  const items = await searchAll();
  const entries = items.map(toEntry).filter(Boolean);
  if (!entries.length) throw new Error("no pull requests found; refusing to empty the board");

  // Merged first, newest merge on top; then open, newest first.
  entries.sort((a, b) =>
    a.status !== b.status ? (a.status === "merged" ? -1 : 1) : b._at.localeCompare(a._at));

  const json = "[\n" + entries
    .map(({ status, org, repo, pr, what, url }) => "  " + JSON.stringify({ status, org, repo, pr, what, url }).replace(/":/g, '": ').replace(/,"/g, ', "').replace(/^\{/, "{ ").replace(/\}$/, " }"))
    .join(",\n") + "\n]\n";
  fs.writeFileSync(OUT, json);

  const md = fs.readFileSync(README, "utf8");
  const a = md.indexOf(START), b = md.indexOf(END);
  if (a !== -1 && b > a) {
    fs.writeFileSync(README, md.slice(0, a) + readmeList(entries) + md.slice(b + END.length));
  } else {
    console.warn("README markers not found; README left untouched");
  }

  const m = entries.filter((e) => e.status === "merged").length;
  console.log(`synced ${entries.length} PRs (${m} merged, ${entries.length - m} open) from ${items.length} search results`);
}

main().catch((e) => { console.error(e); process.exit(1); });
