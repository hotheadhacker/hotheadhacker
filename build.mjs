// Rebuilds the auto-generated sections of README.md from the GitHub API.
// Runs hourly in .github/workflows/build.yml; no dependencies (Node 20+).
import { readFileSync, writeFileSync } from "node:fs";

const USER = "hotheadhacker";
const ORGS = ["cosmicstack-labs"];
const FEATURED = [
  ["cosmicstack-labs/mercury-agent", "🪐", "Soul-driven AI agent that runs 24/7 from CLI, Telegram & more"],
  ["hotheadhacker/no-as-a-service", "🙅", "An API that returns a random, realistic \"no\""],
  ["hotheadhacker/seedbox-lite", "🎬", "Lightweight torrent media center"],
  ["hotheadhacker/awesome-selfhost-docker", "🐳", "Curated self-hosted apps you can run with Docker"],
  ["cosmicstack-labs/mercury-agent-skills", "🧩", "Reusable skills for Mercury, OpenClaw & Hermes agents"],
  ["cosmicstack-labs/lazy-frames", "🎞️", "Agentic, fully local video generation"],
  ["hotheadhacker/youtube-player", "▶️", "Minimal YouTube player"],
];

const headers = { Accept: "application/vnd.github+json", "User-Agent": `${USER}-readme` };
if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

async function gh(path) {
  const res = await fetch(`https://api.github.com${path}`, { headers });
  if (!res.ok) throw new Error(`${res.status} ${path}`);
  return res.json();
}

const fmt = (n) => (n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k` : String(n));
const day = (iso) => iso.slice(0, 10);

const owners = [`/users/${USER}/repos`, ...ORGS.map((o) => `/orgs/${o}/repos`)];
const repos = (await Promise.all(owners.map((p) => gh(`${p}?per_page=100&type=public&sort=pushed`))))
  .flat()
  .filter((r) => !r.fork && !r.archived && !r.private && r.name !== USER && !r.name.startsWith("."))
  .sort((a, b) => b.pushed_at.localeCompare(a.pushed_at));
const byName = new Map(repos.map((r) => [r.full_name, r]));
const user = await gh(`/users/${USER}`);

const featured = FEATURED.map(([name, icon, blurb]) => {
  const r = byName.get(name);
  const stars = r ? ` · ⭐ ${fmt(r.stargazers_count)}` : "";
  return `- ${icon} **[${name.split("/")[1]}](https://github.com/${name})**${stars} — ${blurb}`;
}).join("\n");

const recent = repos.slice(0, 40);
const releases = (
  await Promise.all(
    recent.map((r) => gh(`/repos/${r.full_name}/releases?per_page=3`).catch(() => []).then((rs) =>
      rs.filter((x) => !x.draft).map((x) => ({ repo: r.name, tag: x.tag_name, url: x.html_url, at: x.published_at })),
    )),
  )
).flat().sort((a, b) => b.at.localeCompare(a.at)).slice(0, 6);

const releasesMd = releases.length
  ? releases.map((x) => `[${x.repo} ${x.tag}](${x.url}) — ${day(x.at)}`).join("<br/>\n")
  : "_No releases yet._";
const activeMd = recent.slice(0, 6)
  .map((r) => `[${r.name}](${r.html_url}) — ${day(r.pushed_at)}`).join("<br/>\n");

const totalStars = repos.reduce((s, r) => s + r.stargazers_count, 0);
const statsMd = `⭐ **${fmt(totalStars)}** stars across **${repos.length}** public repos · 👥 **${fmt(user.followers)}** followers · 🕒 updated ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC`;

let readme = readFileSync("README.md", "utf8");
for (const [key, body] of Object.entries({ featured, releases: releasesMd, active: activeMd, stats: statsMd })) {
  const re = new RegExp(`(<!-- ${key} starts -->)[\\s\\S]*?(<!-- ${key} ends -->)`);
  readme = readme.replace(re, `$1\n${body}\n$2`);
}
writeFileSync("README.md", readme);
