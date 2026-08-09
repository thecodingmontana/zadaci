#!/usr/bin/env node
/**
 * Auto-generates the changelog + version bump from conventional commits since
 * the last release tag, then creates a "chore: release vX.Y.Z" commit + tag.
 *
 * Wired into `pnpm run commit` so every commit flow ends with a release.
 * Skips silently when there are no user-facing commits (feat/fix/perf).
 */

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const CATEGORY_BY_TYPE = {
  feat: "New Features",
  fix: "Bug Fixes",
  perf: "Improvements",
};

const SECTION_ORDER = ["New Features", "Improvements", "Bug Fixes"];

function run(cmd) {
  return execSync(cmd, { cwd: root, encoding: "utf8" }).trim();
}

function parseCommit(line) {
  const [hash, date, ...rest] = line.split("|");
  const subject = rest.join("|");
  const m = subject.match(/^([a-z]+)(?:\([^)]*\))?(!)?:\s?(.*)$/);
  if (!m) return null;
  return { hash, date, type: m[1], breaking: !!m[2], subject: m[3] };
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// 1. Determine commit range since the last release tag
const tags = run('git tag -l "v*" --sort=-v:refname')
  .split("\n")
  .map((t) => t.trim())
  .filter(Boolean);

const range = tags.length ? `${tags[0]}..HEAD` : "";
if (tags.length) {
  console.log(`📦  Comparing commits since ${tags[0]}`);
} else {
  console.log("ℹ️  No release tags found — will scan all commit history.");
}

// 2. Collect + categorize user-facing commits (git log is newest-first)
const log = run(`git log ${range} --pretty=format:"%h|%ad|%s" --date=short`).split("\n");
const userFacing = log
  .map(parseCommit)
  .filter(Boolean)
  .filter((c) => CATEGORY_BY_TYPE[c.type]);

if (!userFacing.length) {
  console.log(
    "ℹ️  No user-facing commits (feat/fix/perf) since the last release. Nothing to release.",
  );
  process.exit(0);
}

const sections = SECTION_ORDER.map((category) => ({
  category,
  items: userFacing
    .filter((c) => CATEGORY_BY_TYPE[c.type] === category)
    .map((c) => capitalize(c.subject)),
})).filter((s) => s.items.length);

// 3. Compute the next version
const hasBreaking = userFacing.some((c) => c.breaking);
const pkgPath = resolve(root, "package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
const [major, minor, patch] = pkg.version.split(".").map(Number);
let next;
if (hasBreaking) next = `${major + 1}.0.0`;
else if (userFacing.some((c) => c.type === "feat")) next = `${major}.${minor + 1}.0`;
else next = `${major}.${minor}.${patch + 1}`;

// 4. Release date = date of the most recent commit being released
const date = userFacing[0].date;

// 5. Prepend the release to changelog/entries.ts
function sectionToTs(s) {
  return `      {
        category: "${s.category}",
        items: [
${s.items.map((i) => `          ${JSON.stringify(i)},`).join("\n")}
        ],
      },`;
}

const releaseTs = `  {
    version: "${next}",
    date: "${date}",
    sections: [
${sections.map(sectionToTs).join("\n")}
    ],
  },`;

const entriesPath = resolve(root, "changelog/entries.ts");
const marker = "export const changelogReleases: ChangelogRelease[] = [";
const entries = readFileSync(entriesPath, "utf8");
if (!entries.includes(marker)) {
  console.error("❌ Could not find changelogReleases marker in changelog/entries.ts");
  process.exit(1);
}
writeFileSync(entriesPath, entries.replace(marker, `${marker}\n${releaseTs}`));

// 6. Bump package.json version
pkg.version = next;
writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);

// 7. Add a one-line entry to AGENTS.md release history
const summarySource = sections[0].items;
const summary = summarySource.slice(0, 2).join("; ") + (summarySource.length > 2 ? "…" : "");

const agentsPath = resolve(root, "AGENTS.md");
const agents = readFileSync(agentsPath, "utf8");
const historyMarker = "## Changelog / release history";
const idx = agents.indexOf(historyMarker);
if (idx === -1) {
  console.error("❌ Could not find 'Changelog / release history' section in AGENTS.md");
  process.exit(1);
}
const insertAt = idx + historyMarker.length;
writeFileSync(
  agentsPath,
  `${agents.slice(0, insertAt)}\n\n- **${next} (${date})** — ${summary}${agents.slice(insertAt)}`,
);

// 8. Commit + tag the release
run("git add changelog/entries.ts package.json AGENTS.md");
run(`git commit -m "chore: release v${next}"`);
run(`git tag v${next}`);

console.log("");
console.log(`✅ Released v${next} (${date})`);
console.log(`   ${sections.map((s) => `${s.category}: ${s.items.length}`).join(" · ")}`);
console.log(`   Tag: v${next}`);
