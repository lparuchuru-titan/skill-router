#!/usr/bin/env node
/**
 * Score eval/prompts.jsonl with the scorers this repo can actually run,
 * and write eval/results.json plus eval/results.md.
 *
 * The blog and the README quote results.json. Re-run this after any
 * prompt or skill-description change, then rebuild the blog.
 *
 *   node eval/compare.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildCorpus, loadIndex, rankSkills, tokenize } from "../lib/score.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const floor = process.env.SKILL_ROUTER_FLOOR === undefined || process.env.SKILL_ROUTER_FLOOR === ""
  ? 1.5
  : Number(process.env.SKILL_ROUTER_FLOOR);

const prompts = fs.readFileSync(path.join(here, "prompts.jsonl"), "utf8").split("\n").filter(Boolean).map((line) => JSON.parse(line));
const inScope = prompts.filter((prompt) => prompt.expected.length > 0);
const outScope = prompts.filter((prompt) => prompt.expected.length === 0);
const index = loadIndex(root);

function frontmatterSkills() {
  return index.skills.map((skill) => ({ ...skill }));
}

function withBodies() {
  return index.skills.map((skill) => {
    const file = path.join(index.skillsDir, skill.dir, "SKILL.md");
    const raw = fs.readFileSync(file, "utf8").replace(/^---[\s\S]*?\n---\n/, "");
    return { ...skill, extraText: raw };
  });
}

function intentRank(query) {
  const text = query.toLowerCase();
  for (const rule of index.intents || []) {
    const hit = (rule.when || []).find((phrase) => text.includes(String(phrase).toLowerCase()));
    if (hit) return [{ skill: rule.skill, score: 1 }];
  }
  return [];
}

function overlapRank(query) {
  const tokens = new Set(tokenize(query));
  const scored = frontmatterSkills().map((skill) => {
    const hay = new Set(tokenize(`${skill.name} ${skill.oneLine} ${skill.dir}`));
    let score = 0;
    for (const token of tokens) if (hay.has(token)) score += 1;
    return { skill: skill.dir, score };
  }).filter((row) => row.score > 0).sort((a, b) => b.score - a.score);
  return scored.slice(0, 5);
}

function bm25Rank(skills, query) {
  const corpus = buildCorpus(skills);
  return rankSkills(corpus, index.intents, query, { limit: 5, floor });
}

const scorers = [
  { id: "intent-list", label: "Intent list (first matching phrase)", rank: (query) => intentRank(query) },
  { id: "token-overlap", label: "Token overlap, no IDF", rank: (query) => overlapRank(query) },
  { id: "bm25", label: "BM25 on name, description, keywords", rank: (query) => bm25Rank(frontmatterSkills(), query) },
  { id: "bm25-body", label: "BM25 plus the full skill body", rank: (query) => bm25Rank(withBodies(), query) },
];

function sameSet(got, expected) {
  return got.length === expected.length && expected.every((skill) => got.includes(skill));
}

function metrics(rank) {
  let recall1 = 0;
  let recall3 = 0;
  let reciprocal = 0;
  let exact = 0;
  let paraphrase1 = 0;
  let paraphraseN = 0;
  let multi = 0;
  let multiExact = 0;
  const misses = [];
  for (const prompt of inScope) {
    const hits = rank(prompt.query).map((hit) => hit.skill);
    const at = hits.findIndex((skill) => prompt.expected.includes(skill));
    const full = sameSet(hits, prompt.expected);
    if (at === 0) recall1 += 1;
    if (at >= 0 && at < 3) recall3 += 1;
    if (at >= 0) reciprocal += 1 / (at + 1);
    if (full) exact += 1;
    else misses.push({ id: prompt.id, type: prompt.type, query: prompt.query, expected: prompt.expected, got: hits.length ? hits.join("|") : "(abstain)" });
    if (prompt.expected.length > 1) {
      multi += 1;
      if (full) multiExact += 1;
    }
    if (prompt.type === "paraphrase") {
      paraphraseN += 1;
      if (at === 0) paraphrase1 += 1;
    }
  }
  let falseFires = 0;
  const falseList = [];
  for (const prompt of outScope) {
    const hits = rank(prompt.query);
    if (hits.length) {
      falseFires += 1;
      falseList.push({ id: prompt.id, query: prompt.query, got: hits[0].skill });
    }
  }
  const n = inScope.length || 1;
  return {
    recallAt1: round((100 * recall1) / n),
    recallAt1Count: recall1,
    exactSet: round((100 * exact) / n),
    exactSetCount: exact,
    multi,
    multiExact,
    recallAt3: round((100 * recall3) / n),
    mrr: round(reciprocal / n, 3),
    falseFires,
    falseFirePct: round((100 * falseFires) / (outScope.length || 1)),
    paraphraseN,
    paraphraseRecallAt1: paraphraseN ? round((100 * paraphrase1) / paraphraseN) : null,
    misses,
    falseList,
  };
}

function round(value, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

const rows = scorers.map((scorer) => ({ id: scorer.id, label: scorer.label, ...metrics(scorer.rank) }));
const production = rows.find((row) => row.id === "bm25");

const results = {
  generatedBy: "node eval/compare.mjs",
  floor,
  skills: index.skills.length,
  prompts: {
    inScope: inScope.length,
    outOfScope: outScope.length,
    paraphrase: inScope.filter((prompt) => prompt.type === "paraphrase").length,
    file: "eval/prompts.jsonl",
  },
  rows: rows.map((row) => ({
    id: row.id,
    label: row.label,
    recallAt1: row.recallAt1,
    recallAt1Count: row.recallAt1Count,
    exactSet: row.exactSet,
    exactSetCount: row.exactSetCount,
    multi: row.multi,
    multiExact: row.multiExact,
    recallAt3: row.recallAt3,
    mrr: row.mrr,
    falseFires: row.falseFires,
    falseFirePct: row.falseFirePct,
    paraphraseRecallAt1: row.paraphraseRecallAt1,
  })),
  production: {
    scorer: "bm25",
    recallAt1: production.recallAt1,
    exactSet: production.exactSet,
    exactSetCount: production.exactSetCount,
    multi: production.multi,
    multiExact: production.multiExact,
    recallAt3: production.recallAt3,
    mrr: production.mrr,
    falseFires: production.falseFires,
    paraphraseRecallAt1: production.paraphraseRecallAt1,
    misses: production.misses,
    falseList: production.falseList,
  },
};

const jsonPath = path.join(here, "results.json");
fs.writeFileSync(jsonPath, `${JSON.stringify(results, null, 2)}\n`);

const lines = [
  "# Eval results",
  "",
  "Generated by `node eval/compare.mjs`. This file is the source of truth for the numbers in the blog and the README.",
  "",
  `- Skills indexed: ${results.skills}`,
  `- In-scope prompts: ${results.prompts.inScope} (\`eval/prompts.jsonl\`)`,
  `- Out-of-scope prompts: ${results.prompts.outOfScope}`,
  `- Paraphrase prompts: ${results.prompts.paraphrase}`,
  `- Abstain unless the best score clears ${results.floor}. The formula is in \`lib/score.mjs\`.`,
  "",
  "“Only the skills asked for” means the skills returned are the skills the prompt needs, no extras and none missing. A prompt can need one skill or several.",
  "",
  "| How we picked | Right skill first | Only the skills asked for | Unrelated prompts answered |",
  "| --- | --- | --- | --- |",
];
const plainLabel = {
  "intent-list": "Phrase list. First match wins.",
  "token-overlap": "Count the words in common.",
  bm25: "Name and one-line description. This is what ships.",
  "bm25-body": "Name, description, and the whole skill file.",
};
for (const row of results.rows) {
  lines.push(`| ${plainLabel[row.id] || row.label} | ${row.recallAt1}% (${row.recallAt1Count}/${results.prompts.inScope}) | ${row.exactSet}% (${row.exactSetCount}/${results.prompts.inScope}) | ${row.falseFires}/${results.prompts.outOfScope} |`);
}
const abstained = production.misses.filter((miss) => miss.got === "(abstain)").length;
const wrongSkill = production.misses.length - abstained;
lines.push(
  "",
  `Prompts that need more than one skill: ${production.multiExact}/${production.multi} returned the full set.`,
);
lines.push(
  "",
  `Reworded prompts, shipped matcher: ${production.paraphraseRecallAt1}% of ${results.prompts.paraphrase} put a needed skill first. Of the misses, ${abstained} returned nothing and ${wrongSkill} returned a different skill.`,
  "",
  "## Production misses",
  "",
);
if (!production.misses.length && !production.falseList.length) {
  lines.push("None.");
} else {
  for (const miss of production.misses) {
    lines.push(`- ${miss.id} (${miss.type}) expected ${miss.expected.join("|")} got ${miss.got}: ${miss.query}`);
  }
  for (const miss of production.falseList) {
    lines.push(`- ${miss.id} (out) expected abstain got ${miss.got}: ${miss.query}`);
  }
}
lines.push("");
fs.writeFileSync(path.join(here, "results.md"), `${lines.join("\n")}\n`);

console.log(lines.join("\n"));
