#!/usr/bin/env node
/**
 * stdio MCP server. Zero runtime dependencies.
 *
 * Tools:
 *   find_skill(query, limit?)     ranked skill, or [] when the router abstains
 *   list_skills(filter?)          catalog
 *   read_skill(name)              full SKILL.md
 *   search_topics(query, domain?) keyword search over knowledge topics
 *   read_topic(domain, topic)     one knowledge file
 *
 * Env:
 *   SKILL_ROUTER_ROOT         repo root (default: parent of this file's directory)
 *   SKILL_ROUTER_SKILLS_DIR   override skills directory
 *   SKILL_ROUTER_FLOOR        abstain unless top BM25 score clears this (default 1.5)
 */
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";
import { parseFrontmatter } from "../lib/frontmatter.mjs";
import { abstainFloor, buildCorpus, loadIndex, rankSkills, tokenize } from "../lib/score.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(process.env.SKILL_ROUTER_ROOT || path.resolve(here, ".."));

let index = { skills: [], intents: [], skillsDir: path.join(root, "skills") };
try {
  index = loadIndex(root);
} catch (error) {
  process.stderr.write(`[skill-router] could not read index: ${error.message}\n`);
}
const corpus = buildCorpus(index.skills);
const floor = abstainFloor();

const topics = [];
for (const skill of index.skills.filter((item) => item.hasKnowledge)) {
  const dir = path.join(index.skillsDir, skill.dir, "knowledge", "current", skill.dir);
  if (!fs.existsSync(dir)) continue;
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith(".md") || file === "_index.md") continue;
    const full = path.join(dir, file);
    const fields = parseFrontmatter(fs.readFileSync(full, "utf8"));
    const topic = file.replace(/\.md$/, "");
    const title = fields.title || topic.replace(/-/g, " ");
    topics.push({
      domain: skill.dir,
      topic,
      file: full,
      title,
      description: fields.description || "",
      haystack: `${topic} ${title} ${fields.description || ""} ${fields.keywords || ""}`.toLowerCase(),
    });
  }
}

function findSkill(query, limit = 5) {
  return rankSkills(corpus, index.intents, query, { limit, floor });
}

function listSkills(filter) {
  const needle = (filter || "").toLowerCase();
  return index.skills
    .filter((skill) => {
      if (!needle) return true;
      return skill.dir.includes(needle)
        || (skill.name || "").toLowerCase().includes(needle)
        || (skill.oneLine || "").toLowerCase().includes(needle);
    })
    .map((skill) => ({
      skill: skill.dir,
      name: skill.name,
      hasKnowledge: !!skill.hasKnowledge,
      summary: skill.oneLine,
    }));
}

function readSkill(name) {
  const skill = index.skills.find((item) => item.dir === name || item.name === name);
  if (!skill) return { error: `No skill named '${name}'. Try list_skills.` };
  const filePath = path.join(index.skillsDir, skill.dir, "SKILL.md");
  try {
    return { skill: skill.dir, path: skill.path, content: fs.readFileSync(filePath, "utf8") };
  } catch (error) {
    return { error: `Could not read ${filePath}: ${error.message}` };
  }
}

function searchTopics(query, domain, limit = 8) {
  const tokens = tokenize(query);
  const pool = domain ? topics.filter((topic) => topic.domain === domain) : topics;
  return pool
    .map((topic) => {
      let score = 0;
      for (const token of tokens) {
        if (topic.topic.includes(token)) score += 5;
        else if (topic.haystack.includes(token)) score += 2;
      }
      if (tokens.length && tokens.every((token) => topic.haystack.includes(token))) score += 4;
      return { ...topic, score };
    })
    .filter((topic) => topic.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((topic) => ({
      domain: topic.domain,
      topic: topic.topic,
      title: topic.title,
      description: topic.description,
    }));
}

function readTopic(domain, topic) {
  const hit = topics.find((item) => item.domain === domain && item.topic === topic);
  const filePath = hit
    ? hit.file
    : path.join(index.skillsDir, domain, "knowledge", "current", domain, `${topic}.md`);
  try {
    return { domain, topic, content: fs.readFileSync(filePath, "utf8") };
  } catch (error) {
    return { error: `Could not read topic '${topic}' in '${domain}': ${error.message}` };
  }
}

const tools = [
  {
    name: "find_skill",
    description: "Route a task to the skill that should be loaded first. Returns an empty list when no skill is a confident match.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "The user task to route." },
        limit: { type: "number", description: "Maximum skills to return. Default 5." },
      },
      required: ["query"],
    },
    run: (args) => findSkill(args.query, args.limit || 5),
  },
  {
    name: "list_skills",
    description: "List skills in the catalog. Optional substring filter.",
    inputSchema: {
      type: "object",
      properties: { filter: { type: "string" } },
    },
    run: (args) => listSkills(args.filter),
  },
  {
    name: "read_skill",
    description: "Return the full SKILL.md for a skill directory name.",
    inputSchema: {
      type: "object",
      properties: { name: { type: "string" } },
      required: ["name"],
    },
    run: (args) => readSkill(args.name),
  },
  {
    name: "search_topics",
    description: "Keyword search across curated knowledge topics that ship with a skill.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        domain: { type: "string", description: "Optional skill directory that owns the topics." },
        limit: { type: "number" },
      },
      required: ["query"],
    },
    run: (args) => searchTopics(args.query, args.domain, args.limit || 8),
  },
  {
    name: "read_topic",
    description: "Read one knowledge topic. domain is the skill directory; topic is the filename without .md.",
    inputSchema: {
      type: "object",
      properties: {
        domain: { type: "string" },
        topic: { type: "string" },
      },
      required: ["domain", "topic"],
    },
    run: (args) => readTopic(args.domain, args.topic),
  },
];

const protocol = "2025-06-18";
function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}
function ok(id, result) {
  send({ jsonrpc: "2.0", id, result });
}
function fail(id, code, message) {
  send({ jsonrpc: "2.0", id, error: { code, message } });
}

function handle(message) {
  const { id, method, params } = message;
  if (method === "initialize") {
    return ok(id, {
      protocolVersion: (params && params.protocolVersion) || protocol,
      capabilities: { tools: {} },
      serverInfo: { name: "skill-router", version: "1.0.0" },
    });
  }
  if (method === "notifications/initialized" || method === "notifications/cancelled") return;
  if (method === "ping") return ok(id, {});
  if (method === "tools/list") {
    return ok(id, {
      tools: tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      })),
    });
  }
  if (method === "tools/call") {
    const tool = tools.find((item) => item.name === (params && params.name));
    if (!tool) return fail(id, -32602, `Unknown tool: ${params && params.name}`);
    try {
      const result = tool.run((params && params.arguments) || {});
      return ok(id, { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] });
    } catch (error) {
      return ok(id, { content: [{ type: "text", text: `ERROR: ${error.message}` }], isError: true });
    }
  }
  if (id !== undefined) fail(id, -32601, `Method not found: ${method}`);
}

const lines = readline.createInterface({ input: process.stdin });
lines.on("line", (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  let message;
  try {
    message = JSON.parse(trimmed);
  } catch {
    return;
  }
  try {
    handle(message);
  } catch (error) {
    if (message && message.id !== undefined) fail(message.id, -32603, error.message);
  }
});

process.stderr.write(
  `[skill-router] ready — ${index.skills.length} skills, ${topics.length} topics, floor=${floor}\n`
);
