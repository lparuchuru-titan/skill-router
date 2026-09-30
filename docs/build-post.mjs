/**
 * Builds the external blog post as a Word document.
 *   node docs/build-post.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  AlignmentType,
  BorderStyle,
  Document,
  ExternalHyperlink,
  Footer,
  Header,
  HeadingLevel,
  LevelFormat,
  Packer,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from "docx";

const CONTENT = 10080;
const NAVY = "1B3A4B";
const INK = "243038";
const MUTED = "5E6A71";
const GOLD = "8C6A1A";
const CREAM = "F6F1E6";
const CODE_BG = "F3F1EC";
const ROW = "F4F7F8";
const LINE = "D5DDE2";
const WHITE = "FFFFFF";

const none = { style: BorderStyle.NONE, size: 0, color: WHITE };
const hair = { style: BorderStyle.SINGLE, size: 4, color: LINE };
const cellBorders = { top: hair, bottom: hair, left: hair, right: hair };

function run(text, opts = {}) {
  return new TextRun({
    text,
    font: opts.font || "Calibri",
    size: opts.size || 22,
    color: opts.color || INK,
    bold: !!opts.bold,
    italics: !!opts.italics,
  });
}

function para(children, extras = {}) {
  return new Paragraph({
    spacing: { before: extras.before ?? 0, after: extras.after ?? 160, line: 288 },
    ...extras,
    children,
  });
}

function body(text, extras = {}) {
  return para([run(text)], extras);
}

function rich(parts, extras = {}) {
  return para(parts.map((part) => (typeof part === "string" ? run(part) : run(part.text, part))), extras);
}

function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: "E4C98A", space: 1 } },
    spacing: { before: 360, after: 140 },
    children: [run(text, { size: 32, bold: true, color: NAVY })],
  });
}

function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 280, after: 80 },
    children: [run(text, { size: 26, bold: true, color: NAVY })],
  });
}

function bullet(text) {
  return new Paragraph({
    numbering: { reference: "post-bullets", level: 0 },
    spacing: { before: 40, after: 60, line: 276 },
    children: [run(text)],
  });
}

function step(text) {
  return new Paragraph({
    numbering: { reference: "post-steps", level: 0 },
    spacing: { before: 40, after: 60, line: 276 },
    children: [run(text)],
  });
}

function callout(text) {
  return new Table({
    width: { size: CONTENT, type: WidthType.DXA },
    columnWidths: [CONTENT],
    rows: [
      new TableRow({
        cantSplit: true,
        children: [
          new TableCell({
            width: { size: CONTENT, type: WidthType.DXA },
            shading: { type: ShadingType.CLEAR, fill: CREAM },
            borders: {
              top: none,
              bottom: none,
              right: none,
              left: { style: BorderStyle.SINGLE, size: 16, color: GOLD },
            },
            margins: { top: 120, bottom: 120, left: 180, right: 180 },
            children: [
              new Paragraph({
                spacing: { before: 0, after: 0, line: 276 },
                children: [run(text, { italics: true })],
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

function spacer() {
  return new Paragraph({ spacing: { before: 0, after: 120 }, children: [] });
}

function code(lines) {
  return lines.map((line, index) => new Paragraph({
    shading: { type: ShadingType.CLEAR, fill: CODE_BG },
    spacing: { before: index === 0 ? 80 : 0, after: index === lines.length - 1 ? 80 : 0, line: 240 },
    children: [run(line.length ? line : " ", { font: "Consolas", size: 18, color: "1A2830" })],
  }));
}

function cell(text, width, opts = {}) {
  const fill = opts.fill || WHITE;
  const color = opts.color || INK;
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    shading: { type: ShadingType.CLEAR, fill },
    borders: cellBorders,
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 60, bottom: 60, left: 80, right: 80 },
    children: [
      new Paragraph({
        spacing: { before: 0, after: 0 },
        children: [run(text, { size: opts.size || 18, bold: !!opts.bold, color, font: "Calibri" })],
      }),
    ],
  });
}

function table(headers, rows, widths) {
  const head = new TableRow({
    tableHeader: true,
    cantSplit: true,
    children: headers.map((header, i) => cell(header, widths[i], { fill: NAVY, color: WHITE, bold: true, size: 18 })),
  });
  const bodyRows = rows.map((row, rowIndex) => new TableRow({
    cantSplit: true,
    children: row.map((value, i) => cell(String(value), widths[i], {
      fill: rowIndex % 2 ? ROW : WHITE,
      bold: i === 0,
    })),
  }));
  return new Table({
    width: { size: CONTENT, type: WidthType.DXA },
    columnWidths: widths,
    rows: [head, ...bodyRows],
  });
}

function linkRun(url, label) {
  return new ExternalHyperlink({
    link: url,
    children: [new TextRun({ text: label, font: "Calibri", size: 22, style: "Hyperlink" })],
  });
}

const doc = new Document({
  creator: "Lakshmikanth Paruchuru",
  title: "Load the Right Skill First",
  description: "A measured router for agent skill catalogs.",
  styles: {
    default: {
      document: { run: { font: "Calibri", size: 22, color: INK } },
    },
    paragraphStyles: [
      {
        id: "Heading1",
        name: "Heading 1",
        basedOn: "Normal",
        next: "Normal",
        quickFormat: true,
        run: { font: "Calibri", size: 32, bold: true, color: NAVY },
        paragraph: { spacing: { before: 360, after: 140 }, outlineLevel: 0 },
      },
      {
        id: "Heading2",
        name: "Heading 2",
        basedOn: "Normal",
        next: "Normal",
        quickFormat: true,
        run: { font: "Calibri", size: 26, bold: true, color: NAVY },
        paragraph: { spacing: { before: 280, after: 80 }, outlineLevel: 1 },
      },
    ],
  },
  numbering: {
    config: [
      {
        reference: "post-bullets",
        levels: [{
          level: 0,
          format: LevelFormat.BULLET,
          text: "•",
          alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } },
        }],
      },
      {
        reference: "post-steps",
        levels: [{
          level: 0,
          format: LevelFormat.DECIMAL,
          text: "%1.",
          alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } },
        }],
      },
    ],
  },
  sections: [{
    properties: {
      page: {
        size: { width: 12240, height: 15840 },
        margin: { top: 1008, bottom: 1008, left: 1080, right: 1080, header: 576, footer: 576 },
      },
    },
    headers: {
      default: new Header({
        children: [
          new Paragraph({
            border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: NAVY, space: 6 } },
            spacing: { after: 120 },
            children: [
              run("Lakshmikanth Paruchuru", { size: 16, color: MUTED }),
              run("   ·   ", { size: 16, color: "C5CED3" }),
              run("Notes on agent skills", { size: 16, italics: true, color: MUTED }),
            ],
          }),
        ],
      }),
    },
    footers: {
      default: new Footer({
        children: [
          new Paragraph({
            border: { top: { style: BorderStyle.SINGLE, size: 6, color: LINE, space: 8 } },
            spacing: { before: 80 },
            alignment: AlignmentType.LEFT,
            children: [
              run("Load the right skill first", { size: 16, color: MUTED, italics: true }),
              run("          ", { size: 16 }),
              new TextRun({ children: [PageNumber.CURRENT], font: "Calibri", size: 16, color: MUTED }),
              run(" / ", { size: 16, color: MUTED }),
              new TextRun({ children: [PageNumber.TOTAL_PAGES], font: "Calibri", size: 16, color: MUTED }),
            ],
          }),
        ],
      }),
    },
    children: [
      para([run("DRAFT FOR EXTERNAL PUBLICATION", { size: 16, bold: true, color: GOLD })], { after: 40 }),
      new Paragraph({
        spacing: { before: 80, after: 80 },
        children: [run("Load the right skill first", { size: 48, bold: true, color: NAVY })],
      }),
      para([
        run("A measured router for agent skill catalogs, and why it stayed lexical.", { size: 24, italics: true, color: MUTED }),
      ], { after: 80 }),
      para([
        run("Lakshmikanth Paruchuru", { size: 20, bold: true, color: NAVY }),
        run("   ·   September 30, 2026", { size: 20, color: MUTED }),
      ], { after: 160 }),

      table(
        ["Field", "Value"],
        [
          ["Suggested slug", "load-the-right-skill-first"],
          ["Tags", "AI agents, MCP, BM25, developer tools, Claude, Cursor"],
          ["Code", "github.com/lparuchuru-titan/skill-router"],
          ["Length", "About 1,800 words"],
        ],
        [2200, 7880],
      ),
      spacer(),

      body("A coding agent with ninety skills does not fail because it lacks instructions. It fails because it loads the wrong ones, or loads none, and then improvises. I hit that wall while maintaining a Salesforce delivery kit large enough that the skill list itself became the problem. The router in this post is the general version of the fix. It does not know Salesforce. It knows how to pick one skill, name anything that should load beside it, and stay quiet when the prompt is not a skill at all."),
      callout("Empty is a successful answer. A router that always picks something will eventually enforce the wrong playbook with complete confidence."),
      spacer(),

      h1("The failure mode"),
      body("A skill, in the sense this router cares about, is a markdown file. The frontmatter carries a name and a description. The body carries the procedure: what to read, what to refuse, what “done” means. Hosts such as Claude Code and Cursor already match a prompt against those descriptions. That match is enough while the catalog is small."),
      body("Past a few dozen skills, two failures show up in real sessions."),
      bullet("Overlapping descriptions steal each other’s prompts. Deploy, promote, release, and pipeline all sound like the same task to a loose keyword scan, and they are different jobs with different checks."),
      bullet("The agent answers from memory when a playbook exists. The output is fluent, and it skips the guardrails the skill was written to enforce."),
      body("Putting every skill into the prompt does not fix this. The descriptions crowd each other, and the bodies blow the context window before the agent has done any work. What you want is a cheap step in front: return the one skill to load, or return nothing."),

      h1("What gets indexed"),
      body("A generator walks skills/ and reads each SKILL.md. It keeps the routing signal and throws away the procedure: directory name, frontmatter name, description, and a short keyword list taken from that description. It writes two artifacts from the same pass."),
      bullet("router/skills-index.json is the catalog the server scores against."),
      bullet("ROUTER.md is the same catalog for a person, plus a companion table."),
      body("The body of the skill is not in the index. That choice came from a measurement, which is in the bake-off below. The procedure is loaded later, on purpose, by a separate tool, after the route has already been decided."),
      body("If a skill ships a folder of curated notes rather than a single procedure, the generator also rebuilds a topic index for that folder. Routing still picks the skill. A second, simpler search picks the note."),

      h1("Three ways to ask"),
      body("The same index is exposed three ways, because different hosts will reach for different ones."),
      step("The markdown table. Point the agent at ROUTER.md if you want it to read the map itself."),
      step("An MCP server. Five tools, newline-delimited JSON-RPC on stdin, no packages to install."),
      step("An optional hook. It runs when a prompt arrives and, only when it is sure, injects one line: load this skill first."),
      spacer(),
      table(
        ["Tool", "Returns"],
        [
          ["find_skill", "The ranked skill, the tokens that matched, a one-line why, and companions. An empty list when the router abstains."],
          ["list_skills", "The catalog, with an optional substring filter."],
          ["read_skill", "The full SKILL.md, so the agent follows the procedure after the route."],
          ["search_topics", "Keyword hits inside a skill’s curated notes."],
          ["read_topic", "One note, by domain and topic id."],
        ],
        [2400, 7680],
      ),
      spacer(),
      body("find_skill is the tool that matters. The others exist so the agent can load what the router named, instead of guessing a path."),

      h1("How a prompt is scored"),
      body("The scorer is BM25, the ranking function behind a lot of ordinary search. There is no embedding model, no vector database, and no runtime dependency. Node 18 and the standard library are the whole stack."),
      body("Each skill becomes a short document, with repetition used as a field weight:"),
      bullet("The name, three times."),
      bullet("The one-line description, twice."),
      bullet("The keywords, twice."),
      bullet("The directory name, with hyphens read as spaces."),
      body("BM25 then does the usual thing. A term that appears in one skill and almost nowhere else is worth more than a term that appears everywhere. “Select” is cheap if half the catalog is about queries. “Idempotency” is expensive if only one skill owns it. The constants are the common ones: k1 = 1.5 and b = 0.75. Inverse document frequency is log(1 + (N − df + 0.5) / (df + 0.5)), where N is the number of skills and df is how many of them contain the term."),
      body("There is a floor. If the top score is below it, find_skill returns an empty list. On the ninety-skill catalog that floor landed near 10, because a rare term scores higher as the catalog grows. On the seven-skill sample in the reference repo, the same idea is a floor of 1.5. Those two numbers are not interchangeable. When you add skills, sweep the floor against your gold set. Do not inherit one."),
      body("A second threshold, set at 70 percent of the floor, lets a close runner-up through so you can still measure Recall@3. Anything under that line is dropped."),

      h1("Companions do not vote"),
      body("The first version also had a hand-written intent list. If the prompt contained certain phrases, a named skill owned the task, and a few other skills were supposed to load beside it. It felt like the precise part of the system. Measured against a gold set, it was the part that mis-routed."),
      body("Phrases overlap. “Validate” belongs to more than one workflow. The first matching rule won, which is a priority list pretending to be a judgment. That approach reached 58.6 percent Recall@1, and it still answered confidently on 10 percent of prompts that should have been refused."),
      body("The list kept one job. After BM25 picks a winner, a companion map can say: when the release skill wins, also load the docs skill. Those names come back as load-with. They do not change who won. If you do not need companions, leave the map empty. An earlier mistake was letting the same list both rank and annotate. Ranking is BM25. Annotation happens after."),

      h1("The bake-off"),
      body("I froze a gold set of 70 prompts taken from real tasks, spread across the kinds of work the catalog covered, plus 10 prompts that should abstain because they had nothing to do with any skill. Every scorer saw the same lines. The metrics were Recall@1 (the right skill is first), Recall@3 (the right skill is in the top three), mean reciprocal rank, and how often a scorer answered a prompt it should have refused."),
      spacer(),
      table(
        ["Scorer", "Recall@1", "Recall@3", "MRR", "False fire"],
        [
          ["Keyword rules + intent list", "58.6%", "80.0%", "0.687", "10%"],
          ["BM25 on name, description, keywords", "75.7%", "88.6%", "0.822", "0%"],
          ["BM25 plus the full skill body", "70.0%", "85.7%", "0.782", "10%"],
          ["Local embeddings (bge-small)", "64.3%", "75.7%", "0.700", "0%"],
          ["BM25 fused with embeddings", "75.7%", "84.3%", "0.812", "20%"],
        ],
        [4680, 1300, 1400, 1100, 1600],
      ),
      spacer(),
      body("Four results decided the design."),
      body("BM25 on the frontmatter won, and it refused every out-of-scope prompt in that set. That is the row that shipped."),
      body("Adding the skill body made routing worse, down to 70 percent Recall@1, and it started firing on a negative. Skill bodies share a lot of ordinary instructional prose. There is enough of that shared language to pull the wrong skill into first place. The distinctive words already live in the description. The body belongs in read_skill, which runs after the route."),
      body("A small local embedding model, bge-small, on the order of a hundred megabytes, landed at 64.3 percent Recall@1. Better than the old keyword rules, worse than BM25, and it costs a model the rest of the system does not need. General embeddings are trained to treat paraphrases as the same idea. In a skill catalog the difference between two skills is often one exact term: a command, a metadata type, a filename. BM25 treats that term as rare and therefore decisive. The embedding model smooths it into a neighborhood."),
      body("Fusing BM25 with embeddings by reciprocal rank kept the same 75.7 percent Recall@1 and raised false activations to 20 percent. The fusion was more willing to answer. That is the wrong direction for a component whose job includes refusing."),
      callout("The body of a skill is context for doing the task. It is noise for choosing the task. Index the description. Load the body only after the skill has won."),
      spacer(),

      h1("What 76 percent hides"),
      body("A later run on the live index sat in the same band, about 76 percent Recall@1. That number is not “the router understands the work.” The weak slice was paraphrase: prompts that described the job without using the skill’s vocabulary. On that slice, Recall@1 was about 31 percent, and the embedding model did not rescue it either."),
      body("The fix is in the description. If people say “the calculator script” and the skill only says “quote plugin,” the router will miss, and it should, until their words are in the frontmatter. A description edit that helps one phrasing often steals another skill’s prompts. You will not see the theft by rereading the description. You see it when a gold prompt that used to pass starts landing on the neighbor."),
      body("That is the whole reason the eval exists. Every skill you add, and every description you tune, comes with at least one prompt that must hit and, if the new vocabulary is broad, one prompt that must abstain. The reference repo gates the sample catalog at 90 percent Recall@1 and zero false activations. On that toy set it currently scores 100 percent across 14 in-scope prompts and refuses all 4 negatives. Do not quote the 100 percent next to the 75.7 percent. The sample skills were written so their vocabularies barely overlap. A real catalog overlaps. Trust the eval on your prompts."),

      h1("Silence is part of the design"),
      body("An MCP tool is called on purpose. A hook is not. It sees every prompt, including dinner plans and laptop shopping, and it has to stay quiet on those. The hook uses the same scorer as the server, then adds one extra gate: at least one matched token has to be distinctive, meaning its inverse document frequency clears a second threshold. A prompt that only shares ordinary words with the catalog produces no output."),
      body("The hook is fail-open. If the index is missing or the process throws, it prints nothing and exits 0. A hint must never block the session. It appends a small jsonl log of fires and abstains. After a week of use, read the fires for mis-routes and the highest-scoring abstains for real tasks it stayed silent on. Both become new rows in the gold set. That loop, more than the formula, is what keeps the router from rotting as the catalog grows."),

      h1("Notes, one level down"),
      body("Some skills are not procedures. They are a folder of curated notes: a status-code table, a pagination note, an idempotency note. Routing picks the skill. search_topics then read_topic picks the note. I did not put BM25 on that second hop. A single skill’s topic list is small, the filenames are already good queries, and a second ranking function would be a second floor to tune. The sample repo includes one such skill, a short HTTP API guide, so the shape is visible without anyone’s internal notes attached."),

      h1("Run it"),
      new Paragraph({
        spacing: { before: 0, after: 160, line: 288 },
        children: [
          run("The reference implementation is "),
          linkRun("https://github.com/lparuchuru-titan/skill-router", "github.com/lparuchuru-titan/skill-router"),
          run(". Seven sample skills, a companion map, the MCP server, the hook, and the eval. Wire the server into any MCP client:"),
        ],
      }),
      ...code([
        "{",
        "  \"mcpServers\": {",
        "    \"skill-router\": {",
        "      \"command\": \"node\",",
        "      \"args\": [\"mcp/server.mjs\"]",
        "    }",
        "  }",
        "}",
      ]),
      spacer(),
      body("Rebuild the index after you add or edit a skill, then run the gate:"),
      ...code([
        "node scripts/generate-index.mjs",
        "node eval/run-eval.mjs --gate 90",
      ]),
      spacer(),
      body("Adding a skill is four steps."),
      step("Create skills/<name>/SKILL.md. Put the words a person would actually type into the description. That sentence is the routing signal."),
      step("If another skill should come along, add it under also in router/intents.json. That entry is attached after a winner is chosen."),
      step("Add a gold prompt that must hit, and a negative if the new words could false-fire."),
      step("Regenerate the index and run the eval. If Recall@1 drops or a negative fires, fix the description or sweep the floor before you add the next skill."),
      spacer(),
      body("Set SKILL_ROUTER_ROOT if the checkout is not the working directory, and SKILL_ROUTER_SKILLS_DIR if the skills live somewhere else, such as a user-level skills folder. Set SKILL_ROUTER_FLOOR when you retune."),

      h1("What I would leave out"),
      body("I would leave out a vector index aimed at the last bit of paraphrase recall. The bake-off says the gain is not there, and the cost is a model, a dependency, and worse abstain behavior once you fuse the two scores."),
      body("I would leave the intent list out of the vote. It is a good companion map and a good human index. It is a bad ranker, and we already measured that."),
      body("I would leave the skill body out of the index. More text at route time felt like more context. It was more ways to tie."),

      h1("The boring version is the one that works"),
      body("The useful shape of this system is small. A generated index. A lexical ranker. A floor you retune when the catalog changes. A gold set that fails the build when routing gets worse. A rule that an empty result is a valid result. The agent loads one skill and does the task that skill describes. When the prompt is not one of yours, the router gets out of the way."),
      spacer(),
      para([
        run("Lakshmikanth Paruchuru", { bold: true, color: NAVY }),
      ], { after: 40 }),
      para([
        run("Reference code: ", { size: 20, color: MUTED }),
        linkRun("https://github.com/lparuchuru-titan/skill-router", "github.com/lparuchuru-titan/skill-router"),
      ], { after: 40 }),
      para([
        run("September 30, 2026", { size: 20, color: MUTED, italics: true }),
      ], { after: 0 }),
    ],
  }],
});

const out = path.join(path.dirname(fileURLToPath(import.meta.url)), "Load-the-Right-Skill-First.docx");
const buffer = await Packer.toBuffer(doc);
fs.writeFileSync(out, buffer);
console.log(out);
