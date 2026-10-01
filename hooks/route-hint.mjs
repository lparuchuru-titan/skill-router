#!/usr/bin/env node
/**
 * Opt-in prompt hook. Reads one JSON object or a plain line from stdin.
 * Prints a one-line hint only when the router is confident and a distinctive
 * token matched. Prints nothing otherwise. Any error exits 0 with no output.
 *
 * Env:
 *   SKILL_ROUTER_ROOT
 *   SKILL_ROUTER_FLOOR       default 1.5
 *   SKILL_ROUTER_RARE_IDF    a matched token must clear this idf (default 1.2)
 *   SKILL_ROUTER_LOG         log path, or "off"
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { abstainFloor, buildCorpus, loadIndex, rankSkills } from "../lib/score.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(process.env.SKILL_ROUTER_ROOT || path.resolve(here, ".."));
const rareIdf = Number(process.env.SKILL_ROUTER_RARE_IDF || 1.2);

function readStdin() {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      data += chunk;
    });
    process.stdin.on("end", () => resolve(data));
    process.stdin.on("error", () => resolve(""));
  });
}

function promptFrom(raw) {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  try {
    const parsed = JSON.parse(trimmed);
    return parsed.prompt || parsed.user_prompt || parsed.message || parsed.text || "";
  } catch {
    return trimmed;
  }
}

function logDecision(record) {
  if (process.env.SKILL_ROUTER_LOG === "off") return;
  const file = process.env.SKILL_ROUTER_LOG || path.join(here, "route-hint.log.jsonl");
  try {
    fs.appendFileSync(file, `${JSON.stringify(record)}\n`);
  } catch {
    // Logging must not block the host.
  }
}

const raw = await readStdin();
try {
  const prompt = promptFrom(raw);
  if (!prompt) process.exit(0);
  const index = loadIndex(root);
  const corpus = buildCorpus(index.skills);
  const hits = rankSkills(corpus, index.intents, prompt, { limit: 5, floor: abstainFloor() });
  const hit = hits[0];
  const fire = Boolean(hit && hit.rareIdf >= rareIdf);
  logDecision({
    at: new Date().toISOString(),
    decision: fire ? "fire" : "abstain",
    skill: hits.map((item) => item.skill).join(","),
    score: hit ? hit.score : 0,
    prompt: prompt.slice(0, 240),
  });
  if (!fire) process.exit(0);
  const names = hits.map((item) => `\`${item.skill}\``).join(", ");
  process.stdout.write(
    `Skill router: load ${names} (matched: ${hit.matched.join(", ")}).\n`
  );
} catch {
  process.exit(0);
}
