/**
 * Shared ranker for the MCP server and the optional prompt hook.
 *
 * Each skill is scored from frontmatter only: the name (repeated), the one-line
 * description (repeated), keywords (repeated), and the directory name.
 * The body of SKILL.md is left out.
 *
 * The result is the set of skills to load. A prompt that asks for one job
 * returns that skill. A prompt that asks for two jobs returns both. A weak
 * match returns nothing. Job words are the multi-word keywords on the skill.
 */
import fs from "node:fs";
import path from "node:path";

export const BM_K1 = 1.5;
export const BM_B = 0.75;

const STOP = new Set(
  "a an the of to for in on at by as is are was were be been being it its this that these those and or if but how what when where who why do does did done from with into over under not no we you your our me my can just than then so".split(" ")
);

export function tokenize(text) {
  return ((text || "").toLowerCase().match(/[a-z0-9_+]{2,}/g) || []).filter((token) => !STOP.has(token));
}

export function documentText(skill) {
  const name = skill.name || skill.dir || "";
  const line = skill.oneLine || skill.description || "";
  const keywords = (skill.keywords || []).join(" ");
  const dirWords = String(skill.dir || "").replace(/-/g, " ");
  const extra = skill.extraText || "";
  return [name, name, name, line, line, keywords, keywords, dirWords, extra].join(" ");
}

export function expandHome(value) {
  if (value && value.startsWith("~")) return path.join(process.env.HOME || "", value.slice(1));
  return value;
}

export function loadIndex(root) {
  const indexPath = path.join(root, "router", "skills-index.json");
  const raw = JSON.parse(fs.readFileSync(indexPath, "utf8"));
  const skillsDir = process.env.SKILL_ROUTER_SKILLS_DIR
    ? path.resolve(expandHome(process.env.SKILL_ROUTER_SKILLS_DIR))
    : path.resolve(root, raw.skillsDir || "skills");
  return { ...raw, skillsDir, indexPath };
}

export function buildCorpus(skills) {
  const docs = [];
  const documentFrequency = new Map();
  let totalLength = 0;

  for (const skill of skills || []) {
    const termFrequency = new Map();
    let length = 0;
    for (const token of tokenize(documentText(skill))) {
      termFrequency.set(token, (termFrequency.get(token) || 0) + 1);
      length += 1;
    }
    docs.push({ skill, termFrequency, length });
    totalLength += length;
    for (const token of termFrequency.keys()) {
      documentFrequency.set(token, (documentFrequency.get(token) || 0) + 1);
    }
  }

  const count = docs.length || 1;
  const idf = new Map();
  for (const [token, seenIn] of documentFrequency) {
    idf.set(token, Math.log(1 + (count - seenIn + 0.5) / (seenIn + 0.5)));
  }
  return { docs, idf, avg: totalLength / count, size: docs.length };
}

/** Multi-word job phrases on a skill. Single words stay in the score only. */
export function jobPhrases(skill) {
  return (skill.keywords || [])
    .map((keyword) => String(keyword).toLowerCase().trim())
    .filter((keyword) => keyword.includes(" ") && keyword.length >= 5);
}

export function containsPhrase(query, phrase) {
  const escaped = String(phrase).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i").test(query || "");
}

/**
 * Skills this prompt should load.
 * Returns [] when the best score is below `floor`.
 * Otherwise returns every skill whose own job phrase is in the prompt.
 * If the prompt uses none of those phrases, returns the single best skill.
 */
export function rankSkills(corpus, _intents, query, { limit = 5, floor = 0 } = {}) {
  const queryTokens = [...new Set(tokenize(query))];
  const scored = corpus.docs
    .map(({ skill, termFrequency, length }) => {
      let score = 0;
      const matched = [];
      for (const token of queryTokens) {
        const freq = termFrequency.get(token);
        if (!freq) continue;
        const weight = corpus.idf.get(token) || 0;
        const denominator = freq + BM_K1 * (1 - BM_B + BM_B * (length / (corpus.avg || 1)));
        score += weight * ((freq * (BM_K1 + 1)) / denominator);
        matched.push({ token, idf: weight });
      }
      return { skill, score, matched };
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score);

  const top = scored[0];
  if (!top || top.score < floor) return [];

  const named = scored.filter((row) => {
    if (row.score < floor) return false;
    return jobPhrases(row.skill).some((phrase) => containsPhrase(query, phrase));
  });
  const chosen = (named.length ? named : [top]).slice(0, limit);

  return chosen.map((row) => ({
    skill: row.skill.dir,
    name: row.skill.name,
    score: Math.round(row.score * 100) / 100,
    confidence: row.score >= top.score * 0.85 ? "high" : "medium",
    matched: row.matched.map((item) => item.token).slice(0, 8),
    rareIdf: row.matched.reduce((max, item) => Math.max(max, item.idf), 0),
    why: row.skill.oneLine || "",
    hasKnowledge: !!row.skill.hasKnowledge,
    invoke: `/${row.skill.dir}`,
    path: row.skill.path,
  }));
}

export function abstainFloor() {
  const raw = process.env.SKILL_ROUTER_FLOOR;
  if (raw === undefined || raw === "") return 1.5;
  const value = Number(raw);
  return Number.isFinite(value) ? value : 1.5;
}
