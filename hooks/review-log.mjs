#!/usr/bin/env node
/** Summarize hooks/route-hint.log.jsonl: fires, abstains, and the skills that fired. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const file = process.argv[2] || path.join(here, "route-hint.log.jsonl");
if (!fs.existsSync(file)) {
  console.log(`No log at ${file}`);
  process.exit(0);
}

const rows = fs.readFileSync(file, "utf8").split("\n").filter(Boolean).map((line) => JSON.parse(line));
const fires = rows.filter((row) => row.decision === "fire");
const abstains = rows.filter((row) => row.decision === "abstain");
const bySkill = new Map();
for (const row of fires) bySkill.set(row.skill, (bySkill.get(row.skill) || 0) + 1);

console.log(`${rows.length} decisions · ${fires.length} fired · ${abstains.length} abstained`);
console.log("Skills that fired:");
for (const [skill, count] of [...bySkill.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${count}\t${skill}`);
}
console.log("Highest-score abstains (possible misses):");
for (const row of abstains.sort((a, b) => b.score - a.score).slice(0, 8)) {
  console.log(`  ${row.score}\t${row.prompt}`);
}
