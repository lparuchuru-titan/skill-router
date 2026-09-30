/**
 * Minimal YAML-frontmatter reader for SKILL.md files.
 * Handles single-line values and folded (>, >-) / literal (|, |-) blocks.
 * Not a general YAML parser.
 */

export function parseFrontmatter(text) {
  const match = String(text || "").match(/^---\s*\n([\s\S]*?)\n---/);
  const fields = {};
  if (!match) return fields;

  const lines = match[1].split("\n");
  for (let i = 0; i < lines.length; i++) {
    const kv = lines[i].match(/^([A-Za-z0-9_.-]+):\s*(.*)$/);
    if (!kv) continue;

    const key = kv[1];
    let value = kv[2].trim();
    if (value === ">" || value === ">-" || value === ">+" || value === "|" || value === "|-" || value === "|+") {
      const literal = value.startsWith("|");
      const buf = [];
      let j = i + 1;
      while (j < lines.length && (lines[j].trim() === "" || /^\s+/.test(lines[j]))) {
        buf.push(lines[j].replace(/^\s{1,4}/, ""));
        j++;
      }
      i = j - 1;
      value = literal
        ? buf.join("\n").trim()
        : buf.map((line) => line.trim()).filter(Boolean).join(" ");
    } else {
      value = value.replace(/^["']|["']$/g, "");
    }
    fields[key] = value.replace(/\s+/g, " ").trim();
  }
  return fields;
}

const STOP = new Set(
  "the a an and or of to for in on with use uses using this that skill when user users into your you it its as is are be by from any all not no via per see read run how does what".split(" ")
);

/** Distinctive tokens from a description, plus any explicit keyword list. */
export function keywordsFrom(description, explicit = "") {
  const extra = String(explicit || "")
    .split(/[,]+/)
    .map((part) => part.trim().toLowerCase())
    .filter((part) => part.length >= 2);
  const tokens = String(description || "").toLowerCase().match(/[a-z][a-z0-9_+-]{2,}/g) || [];
  const ordered = [];
  const seen = new Set();
  const push = (token) => {
    if (!token || seen.has(token) || STOP.has(token)) return;
    seen.add(token);
    ordered.push(token);
  };
  for (const token of extra) push(token);
  for (const token of tokens) push(token);
  return ordered.slice(0, 40);
}
