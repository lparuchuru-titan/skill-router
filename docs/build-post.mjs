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
  ImageRun,
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

function step(text, instance = 0) {
  return new Paragraph({
    numbering: { reference: "post-steps", level: 0, instance },
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

const docsDir = path.dirname(fileURLToPath(import.meta.url));
const diagramsDir = path.join(docsDir, "diagrams");
const results = JSON.parse(fs.readFileSync(path.join(docsDir, "../eval/results.json"), "utf8"));
const scored = (id) => results.rows.find((item) => item.id === id);
const pct = (n) => `${Number(n).toFixed(1)}%`;
const fires = (item) => `${item.falseFires}/${results.prompts.outOfScope}`;

function figure(file, alt, width, height, caption) {
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 140, after: 60 },
      children: [
        new ImageRun({
          type: "png",
          data: fs.readFileSync(path.join(diagramsDir, file)),
          transformation: { width, height },
          altText: { title: alt, description: alt, name: file.replace(".png", "") },
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 160 },
      children: [run(caption, { size: 18, italics: true, color: MUTED })],
    }),
  ];
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
        run("Everyone has a skill library now. The part that matters is which skill a prompt actually loads.", { size: 24, italics: true, color: MUTED }),
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
          ["Length", "About 2,200 words"],
        ],
        [2200, 7880],
      ),
      spacer(),

      body("A year ago, a skill library was a novelty. Now it is the default. Teams publish folders of SKILL.md files for Claude, Cursor, and every other coding agent that will read them. Salesforce teams have been early and loud about it: one skill to write Apex, another to run tests, another to deploy, another to grant field access, another to scan the diff. The library grows every week. The agent does not get better at the same rate."),
      body("The miss is not the missing skill. The miss is the prompt. A person types “add a formula field and make sure the existing permission set can see it,” and the agent either loads nothing and improvises, or loads the nearest skill and follows the wrong procedure. Ninety good playbooks in a folder do not help if the turn loads zero of them, or loads the one that creates a new permission set when the task was to edit the set you already have."),
      callout("A skill library answers “what do we know how to do?” The skill router answers “which of those does this prompt need, and which should stay on disk?”"),
      spacer(),
      body(`That second question is the whole product. The catalog measured in this repo is ${results.skills} skills. The router reads the prompt, scores it against skill names and descriptions, and returns the one skill to load. If nothing clears a floor, it returns an empty list. Empty is a successful answer. A router that always picks something will eventually enforce the wrong playbook with complete confidence.`),

      h1("A slice of a Salesforce skill library"),
      body("Here is a small cut of the kind of library people are already installing. These are ordinary Salesforce platform skills. Each one owns a narrow job. The descriptions are the routing signal: the words a person actually types."),
      spacer(),
      table(
        ["Skill", "The prompt it should win"],
        [
          ["platform-soql-query", "Write or check a SOQL or SOSL query."],
          ["platform-apex-generate", "Write or refactor an Apex class or trigger."],
          ["platform-apex-test-generate", "Generate an Apex test, including a bulk case."],
          ["platform-apex-test-run", "Run tests and read the coverage."],
          ["platform-apex-logs-debug", "Read a debug log or a governor-limit failure."],
          ["platform-metadata-retrieve", "Pull metadata from an org into the project."],
          ["platform-metadata-deploy", "Deploy metadata with the Salesforce CLI."],
          ["platform-custom-field-generate", "Create a custom field, including a formula."],
          ["platform-permission-set-generate", "Grant object and field access in a permission set."],
          ["platform-validation-rule-generate", "Author a validation rule."],
          ["automation-flow-generate", "Build a screen, record-triggered, or autolaunched flow."],
          ["dx-code-analyzer-run", "Scan Apex or LWC for security and performance issues."],
        ],
        [4200, 5880],
      ),
      spacer(),
      body("Twelve skills is already enough to collide. “Test” appears in three of them. “Field” appears in two. “Deploy” is a neighbor of “retrieve.” A keyword scan that stops at the first hit will send a coverage question to the skill that generates tests, and a retrieve question to the skill that deploys. The person did not ask for a bigger library. They asked for the prompt to land on the right row."),
      body("Watch one prompt move through the router."),
      bullet("“Write a SOQL query for accounts created this week.” Rare tokens: SOQL, query, accounts. Winner: platform-soql-query. The deploy skill and the Apex skill stay unloaded."),
      bullet("“Run the failing test class and tell me the coverage.” Rare tokens: test, run, coverage. Winner: platform-apex-test-run, not the skill that writes a new test."),
      bullet("“Add a formula field for renewal date.” Winner: platform-custom-field-generate. If the same turn also says “grant access on the existing permission set,” the router can name platform-permission-set-generate as a companion. The companion is loaded with the winner. It does not steal the win."),
      bullet("“What is a good lasagna recipe.” No skill clears the floor. The router returns nothing, and the agent does not invent a Salesforce procedure for dinner."),
      body("That is the help. The library can hold dozens or hundreds of skills. The prompt pays for one of them. Context stays small, the guardrails in that skill actually run, and a prompt that is not yours does not get a random playbook stapled to it."),
      ...figure(
        "01-route.png",
        "A prompt goes to the skill router, which either loads one skill or abstains.",
        620,
        302,
        "Figure 1. A confident match loads one skill. Anything under the floor loads nothing.",
      ),

      h1("How the router helps"),
      body("Without a router, a host matches the prompt against every skill description it was given, or it matches against none and relies on the model’s memory. Both degrade as the library grows. Descriptions start to share words. The context window fills with procedures the turn will not use. The model picks a plausible skill and follows it carefully, which is worse than picking none, because the mistake is now enforced."),
      body("The router sits in front of that, as a tool the agent can call or as a one-line hint before the turn starts. It does five jobs."),
      ...figure(
        "02-library.png",
        "Eight skills stay on disk. One skill is loaded into the turn.",
        620,
        333,
        "Figure 2. The catalog can be large. The turn receives the winner only.",
      ),
      step("It names the owning skill before any code, metadata, or query is written. The agent then reads that SKILL.md and follows it.", 1),
      step("It keeps the rest of the library on disk. find_skill returns a ranked hit, not the catalog. list_skills and read_skill exist so the agent can open exactly what was named.", 1),
      step("It prefers the distinctive word. BM25 scores a term that lives in one skill much higher than a term that lives in twenty. “Coverage” pulls the test-runner. “SOQL” pulls the query skill. “Formula field” pulls field generation.", 1),
      step("It abstains. Below a floor, the result is an empty list. The agent is free to answer directly. It is not free to pretend a skill applied.", 1),
      step("It names companions after the winner is chosen. A field change that also needs access can load the permission-set skill in the same turn. The companion list never reorders the ranking.", 1),
      spacer(),
      body("The same index is available three ways, because hosts differ. ROUTER.md is the human table. An MCP server exposes find_skill, list_skills, read_skill, search_topics, and read_topic over stdin, with no packages to install. An optional hook prints “load this skill first” only when it is sure, and prints nothing otherwise."),

      h1("Extending the library does not mean extending the router"),
      body("This is the part teams underestimate. Adding the next skill should be a file, not a project. The ranker does not get a new branch. You do not retrain a model. You do not edit a priority list of phrases and hope you inserted the rule in the right place."),
      ...figure(
        "03-extend.png",
        "Four steps: write the skill, rebuild the index, prove the route, then use it.",
        620,
        202,
        "Figure 3. Extending the library is a file and an eval run. The router code stays put.",
      ),
      step("Create skills/<name>/SKILL.md. Put the words a person would actually type into the description. That sentence is the routing signal. The body is the procedure, and it is loaded only after the skill wins.", 2),
      step("If another skill should come along for the ride, add one line to the companion map. That line is attached after a winner is chosen. It does not vote.", 2),
      step("Add a gold prompt that must hit this skill, and a negative if the new words could false-fire on an unrelated prompt.", 2),
      step("Regenerate the index and run the eval. If Recall@1 drops or a negative starts firing, the description is overlapping a neighbor, or the floor needs a sweep. Fix that before the next skill.", 2),
      spacer(),
      body("The router code stays put. The index is generated. A new Salesforce skill — a naming-convention check, a permission-set diff, a flow-fault reviewer — shows up in find_skill on the next prompt, because its description is now in the catalog. Removing a skill is the same operation in reverse: delete the folder, regenerate, confirm the gold prompts that used to hit it now abstain or land on the replacement."),
      body("Efficiency here is operational, not clever. The expensive work is writing a sharp description and one prompt that proves it. The cheap work is everything the router does after that. I have added skills to a live catalog this way in minutes. The sessions that went wrong were the ones where I tuned a description by reading it, skipped the gold prompt, and discovered a week later that it had stolen a neighbor’s traffic."),

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

      h1("The tools"),
      body("find_skill is the call that matters. The other four exist so the agent can open exactly the skill or note that won, instead of guessing a path."),
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

      h1("How a prompt is scored"),
      body("The scorer is BM25, the ranking function behind a lot of ordinary search. There is no embedding model, no vector database, and no runtime dependency. Node 18 and the standard library are the whole stack."),
      body("Each skill becomes a short document, with repetition used as a field weight:"),
      bullet("The name, three times."),
      bullet("The one-line description, twice."),
      bullet("The keywords, twice."),
      bullet("The directory name, with hyphens read as spaces."),
      body("BM25 then does the usual thing. A term that appears in one skill and almost nowhere else is worth more than a term that appears everywhere. “Select” is cheap if half the catalog is about queries. “Idempotency” is expensive if only one skill owns it. The constants are the common ones: k1 = 1.5 and b = 0.75. Inverse document frequency is log(1 + (N − df + 0.5) / (df + 0.5)), where N is the number of skills and df is how many of them contain the term."),
      body(`There is a floor. If the top score is below it, find_skill returns an empty list. Common words such as “the” and “for” are stripped before scoring, so they cannot decide a match. The floor checked into this repo is ${results.floor}, which is the value in eval/results.json. A larger catalog changes the scores. Sweep the floor against your gold set when you add skills. Do not copy a floor from a different catalog.`),
      body("A second threshold, set at 70 percent of the floor, lets a close runner-up through so you can still measure Recall@3. Anything under that line is dropped."),

      h1("Companions do not vote"),
      body("A hand-written intent list is still in the repo, in router/intents.json. If the prompt contains one of its phrases, that rule names a skill. The first matching phrase wins. The production router does not use those phrases to rank. eval/compare.mjs scores them so the list can be compared with BM25 on the same prompts."),
      body(`On this gold set the intent list reaches ${pct(scored("intent-list").recallAt1)} Recall@1 (${scored("intent-list").recallAt1Count}/${results.prompts.inScope}) and ${fires(scored("intent-list"))} false fires. It is silent on prompts that do not contain its phrase, which is why every paraphrase misses. It also misses a direct prompt that describes the job without using the exact words in the rule.`),
      body("The list kept one job. After BM25 picks a winner, a companion map can say: when the release skill wins, also load the docs skill. Those names come back as load-with. They do not change who won. If you do not need companions, leave the map empty. An earlier mistake was letting the same list both rank and annotate. Ranking is BM25. Annotation happens after."),

      h1("The bake-off"),
      body(`The gold set is eval/prompts.jsonl in this repo: ${results.prompts.inScope} prompts that name a skill, plus ${results.prompts.outOfScope} prompts that should abstain. ${results.prompts.paraphrase} of the in-scope prompts are paraphrases. They describe the job without the skill’s vocabulary. node eval/compare.mjs scores every row on those same lines and writes eval/results.json. The table below is that file. Recall@1 means the right skill is first. Recall@3 means it is in the top three. False fires are out-of-scope prompts that still returned a skill.`),
      spacer(),
      table(
        ["Scorer", "Recall@1", "Recall@3", "MRR", "False fires"],
        results.rows.map((item) => [
          item.label,
          pct(item.recallAt1),
          pct(item.recallAt3),
          String(item.mrr),
          fires(item),
        ]),
        [4680, 1300, 1400, 1100, 1600],
      ),
      spacer(),
      body(`Frontmatter BM25 is the scorer the server ships. On this run it is ${pct(scored("bm25").recallAt1)} Recall@1 (${scored("bm25").recallAt1Count}/${results.prompts.inScope}), MRR ${scored("bm25").mrr}, and ${fires(scored("bm25"))} false fires. Token overlap, which counts shared words and ignores how rare they are, ties that Recall@1 on this catalog. The two separate once the skill body is included.`),
      body(`BM25 plus the full SKILL.md body falls to ${pct(scored("bm25-body").recallAt1)} Recall@1 and fires on ${fires(scored("bm25-body"))} out-of-scope prompts. Skill bodies share ordinary instructional prose. That prose is enough to pull the wrong skill up and to answer a prompt that should have been refused. The description already holds the distinctive words. The body belongs in read_skill, which runs after the route.`),
      body("This repo does not ship an embedding model, so this post does not quote an embedding score. The four rows above are the comparison eval/compare.mjs can rerun from the files in the repo."),
      callout("The body of a skill is context for doing the task. It is noise for choosing the task. Index the description. Load the body only after the skill has won."),
      spacer(),

      h1(`What the ${pct(scored("bm25").recallAt1)} hides`),
      body(`The ${pct(scored("bm25").recallAt1)} is not “the router understands the work.” All ${results.prompts.inScope - results.prompts.paraphrase} direct prompts hit. All ${results.prompts.paraphrase} paraphrases miss, so paraphrase Recall@1 is ${pct(scored("bm25").paraphraseRecallAt1)}. Those misses are listed in eval/results.md. “Show me customers we added in the last seven days” does not say SOQL, so platform-soql-query does not win.`),
      body("The fix is in the description. If people say “customers we added” and the skill only says “SOQL,” the router will miss, and it should, until their words are in the frontmatter. A description edit that helps one phrasing often steals another skill’s prompts. You will not see the theft by rereading the description. You see it when a gold prompt that used to pass starts landing on the neighbor."),
      body(`That is why the eval is in the repo. Every skill you add comes with at least one prompt that must hit and, if the new vocabulary is broad, one prompt that must abstain. node eval/run-eval.mjs drives the MCP server against the same prompts. The gate in this repo is 80 percent Recall@1 and zero false fires. The last run is ${pct(scored("bm25").recallAt1)} and ${fires(scored("bm25"))}. If you change a description, rerun compare.mjs and rebuild this post from eval/results.json. The file wins if the two disagree.`),

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
          run(`. ${results.skills} skills, a companion map, the MCP server, the hook, and the eval in eval/prompts.jsonl. Wire the server into any MCP client:`),
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
        "node eval/compare.mjs",
        "node eval/run-eval.mjs --gate 80",
      ]),
      spacer(),
      body("Those two commands are the entire extension loop: regenerate the index, then prove the new skill did not steal a neighbor. Set SKILL_ROUTER_ROOT if the checkout is not the working directory, and SKILL_ROUTER_SKILLS_DIR if the skills live somewhere else, such as a user-level skills folder. Set SKILL_ROUTER_FLOOR when you retune."),

      h1("What I would leave out"),
      body("I would leave an embedding model out until it is a scorer in eval/compare.mjs and beats the BM25 row on this gold set, including the false fires. This repo does not have that row."),
      body(`I would leave the intent list out of the vote. On the same prompts it scores ${pct(scored("intent-list").recallAt1)}, below frontmatter BM25, because a prompt that skips the phrase never matches. It stays as the companion map.`),
      body("I would leave the skill body out of the index. More text at route time felt like more context. It was more ways to tie."),

      h1("The boring version is the one that works"),
      body("Skill libraries are everywhere now. The useful next step is small. A generated index. A ranker that sends the prompt to one skill. A floor you retune when the catalog changes. A gold set, checked in, that fails the build when a new skill steals a neighbor. The agent loads that skill and does the task it describes. The rest of the library stays on disk. When the prompt is not one of yours, the router gets out of the way."),
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
