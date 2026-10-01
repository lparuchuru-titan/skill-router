# Gold set

`prompts.jsonl` is the source of truth for routing quality in this repo. The blog quotes `results.json`, which `node eval/compare.mjs` writes from these prompts.

Each line:

```json
{"id":"p01","type":"direct","query":"...","expected":["skill-dir"]}
```

`type` is `direct`, `paraphrase`, or `out`. An empty `expected` array means the router must abstain.

```bash
node scripts/generate-index.mjs
node eval/compare.mjs
node eval/run-eval.mjs --gate 80
```

`run-eval.mjs` drives the MCP server. `compare.mjs` scores the same BM25 function plus the intent-list and full-body variants. If the two disagree on the BM25 row, the server and `lib/score.mjs` have drifted.
