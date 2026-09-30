# Skill Router

A small, dependency-free way to point a coding agent at the right skill before it acts.

Drop a `SKILL.md` in `skills/`. The generator builds an index. An MCP server ranks a prompt with BM25 over each skill's name, description, and keywords, and returns nothing when the match is weak. A gold-set eval keeps that ranking honest.

This repository is a domain-neutral reference. The sample skills are illustrations, not a production catalog.

## Layout

```
skills/*/SKILL.md          instructions the agent should load
router/intents.json        companion map (does not vote)
router/skills-index.json   generated catalog
ROUTER.md                  generated human index
mcp/server.mjs             stdio MCP server
eval/                      gold prompts and Recall@1 / MRR
hooks/route-hint.mjs       optional "load this skill first" hint
```

## Use it

```bash
node scripts/generate-index.mjs
node eval/run-eval.mjs --gate 90
```

Point your MCP client at `mcp/server.mjs`. A starter config is in `mcp/example.mcp.json`.

| Tool | What it returns |
| --- | --- |
| `find_skill` | Ranked skill, companions, and why. Empty when the router abstains. |
| `list_skills` | The catalog. |
| `read_skill` | The full `SKILL.md`. |
| `search_topics` | Hits inside a skill's knowledge files. |
| `read_topic` | One knowledge file. |

```bash
printf '%s\n' \
  '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}' \
  '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"find_skill","arguments":{"query":"write a jest unit test"}}}' \
  | node mcp/server.mjs
```

Environment:

- `SKILL_ROUTER_ROOT` — checkout that holds `router/` and `skills/`
- `SKILL_ROUTER_SKILLS_DIR` — skills live somewhere else
- `SKILL_ROUTER_FLOOR` — abstain unless the top score clears this (default `1.5` on the sample catalog; retune when you add skills)

## Add a skill

1. Create `skills/<name>/SKILL.md` with `name` and `description` frontmatter. The description is the routing signal. Put the words a person would actually type in it.
2. If that skill should pull another skill along, add an `also` entry in `router/intents.json`. That list is attached after a winner is chosen. It does not change the ranking.
3. Add prompts to `eval/prompts.jsonl`, including one out-of-scope prompt if the new vocabulary could false-fire.
4. Run `node scripts/generate-index.mjs` and `node eval/run-eval.mjs --gate 90`.

## Why BM25, not embeddings

On a catalog of about ninety jargon-heavy skills, a head-to-head on 70 in-scope prompts and 10 out-of-scope prompts looked like this:

| Scorer | Recall@1 | Recall@3 | MRR | Out-of-scope false activations |
| --- | --- | --- | --- | --- |
| Keyword rules plus intent list | 58.6% | 80.0% | 0.687 | 10% |
| BM25 on name, description, keywords | 75.7% | 88.6% | 0.822 | 0% |
| BM25 plus the full SKILL.md body | 70.0% | 85.7% | 0.782 | 10% |
| Local embeddings (bge-small) | 64.3% | 75.7% | 0.700 | 0% |
| Hybrid of BM25 and embeddings | 75.7% | 84.3% | 0.812 | 20% |

The body hurt because ordinary prose drowned the distinctive terms. A general embedding model blurred exact names. Fusing the two kept the same top-1 accuracy and started answering prompts that should have abstained.

The floor is not portable. A larger catalog produces higher scores for rare terms. Sweep `SKILL_ROUTER_FLOOR` with the eval when the catalog changes.

## Optional hook

`hooks/route-hint.mjs` prints a one-line hint only when the top skill clears the floor and a distinctive token matched. It stays silent otherwise, and it exits cleanly on any error.

```bash
echo '{"prompt":"write a jest unit test for the parser"}' | node hooks/route-hint.mjs
node hooks/review-log.mjs
```

## License

MIT. Copyright 2026 Lakshmikanth Paruchuru.
