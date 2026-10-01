# Gold set

`prompts.jsonl` is the source of truth for routing quality in this repo. The blog quotes `results.json`, which `node eval/compare.mjs` writes from these prompts.

Each line:

```json
{"id":"p01","type":"direct","query":"...","expected":["skill-dir"]}
{"id":"p71","type":"direct","query":"...","expected":["skill-a","skill-b"]}
```

`type` is `direct`, `paraphrase`, or `out`. `expected` lists every skill the prompt needs. One skill or several. An empty array means the router must abstain. The returned set has to match that list exactly.

```bash
node scripts/generate-index.mjs
node eval/compare.mjs
node eval/run-eval.mjs --gate 80
```

`run-eval.mjs` drives the MCP server and checks the exact set. `compare.mjs` scores the same matcher plus a phrase list, a word-count matcher, and a variant that also reads the skill body. If the server and `lib/score.mjs` disagree on the shipped row, they have drifted.
