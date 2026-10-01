#!/usr/bin/env node
/**
 * Drive the real MCP server over stdio.
 * A pass means the returned skills are exactly the skills the prompt needs,
 * and out-of-scope prompts return nothing.
 *
 *   node eval/run-eval.mjs
 *   node eval/run-eval.mjs --gate 80
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const gateFlag = process.argv.indexOf("--gate");
const gate = gateFlag >= 0 ? Number(process.argv[gateFlag + 1]) : null;

const prompts = fs
  .readFileSync(path.join(here, "prompts.jsonl"), "utf8")
  .split("\n")
  .filter(Boolean)
  .map((line) => JSON.parse(line));

const child = spawn(process.execPath, [path.join(root, "mcp", "server.mjs")], {
  cwd: root,
  env: { ...process.env, SKILL_ROUTER_ROOT: root },
  stdio: ["pipe", "pipe", "inherit"],
});

const pending = new Map();
const lines = readline.createInterface({ input: child.stdout });
lines.on("line", (line) => {
  let message;
  try {
    message = JSON.parse(line);
  } catch {
    return;
  }
  const waiter = pending.get(message.id);
  if (!waiter) return;
  pending.delete(message.id);
  waiter(message);
});

let nextId = 1;
function rpc(method, params) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`timeout waiting for ${method}`));
    }, 8000);
    pending.set(id, (message) => {
      clearTimeout(timer);
      resolve(message);
    });
    child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
  });
}

await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "eval", version: "1.0.0" } });
child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" })}\n`);

function parseHits(message) {
  const text = message.result && message.result.content && message.result.content[0] && message.result.content[0].text;
  return text ? JSON.parse(text) : [];
}

const inScope = prompts.filter((prompt) => prompt.expected.length > 0);
const outScope = prompts.filter((prompt) => prompt.expected.length === 0);
let recall1 = 0;
let exact = 0;
let reciprocal = 0;
let falseHits = 0;
const misses = [];

function sameSet(got, expected) {
  return got.length === expected.length && expected.every((skill) => got.includes(skill));
}

for (const prompt of inScope) {
  const message = await rpc("tools/call", { name: "find_skill", arguments: { query: prompt.query, limit: 5 } });
  const hits = parseHits(message).map((hit) => hit.skill);
  const rank = hits.findIndex((skill) => prompt.expected.includes(skill));
  const full = sameSet(hits, prompt.expected);
  if (rank === 0) recall1 += 1;
  if (full) exact += 1;
  if (rank >= 0) reciprocal += 1 / (rank + 1);
  if (!full) misses.push({ id: prompt.id, query: prompt.query, expected: prompt.expected, got: hits.join("|") || "(abstain)" });
}

for (const prompt of outScope) {
  const message = await rpc("tools/call", { name: "find_skill", arguments: { query: prompt.query, limit: 3 } });
  const hits = parseHits(message);
  if (hits.length) {
    falseHits += 1;
    misses.push({ id: prompt.id, query: prompt.query, expected: [], got: hits[0].skill });
  }
}

child.stdin.end();
child.kill();

const n = inScope.length || 1;
const r1 = (100 * recall1) / n;
const exactPct = (100 * exact) / n;
const mrr = reciprocal / n;
console.log(`In-scope ${inScope.length} · out-of-scope ${outScope.length}`);
console.log(`Right skill first ${r1.toFixed(1)}% (${recall1}/${n})`);
console.log(`Exact set ${exactPct.toFixed(1)}% (${exact}/${n})`);
console.log(`MRR ${mrr.toFixed(3)}`);
console.log(`False activations ${falseHits}/${outScope.length}`);
if (misses.length) {
  console.log("Misses:");
  for (const miss of misses) console.log(`  ${miss.id} expected=${miss.expected.join("|") || "(abstain)"} got=${miss.got} :: ${miss.query}`);
}

if (gate !== null && (exactPct < gate || falseHits > 0)) {
  console.error(`Gate failed (exact set ${exactPct.toFixed(1)} < ${gate}, or a negative fired).`);
  process.exit(1);
}
