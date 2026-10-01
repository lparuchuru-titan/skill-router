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
    font: opts.font || "Arial",
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
const misses = results.production.misses || [];
const abstained = misses.filter((item) => item.got === "(abstain)").length;
const wrongSkill = misses.length - abstained;
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
    children: [run(line.length ? line : " ", { font: "Menlo", size: 18, color: "1A2830" })],
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
        children: [run(text, { size: opts.size || 18, bold: !!opts.bold, color, font: "Arial" })],
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
    children: [new TextRun({ text: label, font: "Arial", size: 22, style: "Hyperlink" })],
  });
}

const doc = new Document({
  theme: {
    fonts: {
      headings: "Arial",
      body: "Arial",
    },
  },
  creator: "Lakshmikanth Paruchuru",
  title: "Load the Right Skill First",
  description: "A measured router for agent skill catalogs.",
  styles: {
    default: {
      document: { run: { font: "Arial", size: 22, color: INK } },
    },
    paragraphStyles: [
      {
        id: "Heading1",
        name: "Heading 1",
        basedOn: "Normal",
        next: "Normal",
        quickFormat: true,
        run: { font: "Arial", size: 32, bold: true, color: NAVY },
        paragraph: { spacing: { before: 360, after: 140 }, outlineLevel: 0 },
      },
      {
        id: "Heading2",
        name: "Heading 2",
        basedOn: "Normal",
        next: "Normal",
        quickFormat: true,
        run: { font: "Arial", size: 26, bold: true, color: NAVY },
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
              new TextRun({ children: [PageNumber.CURRENT], font: "Arial", size: 16, color: MUTED }),
              run(" / ", { size: 16, color: MUTED }),
              new TextRun({ children: [PageNumber.TOTAL_PAGES], font: "Arial", size: 16, color: MUTED }),
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
          ["Tags", "AI agents, Salesforce, skill routing, developer tools, Claude, Cursor"],
          ["Code", "github.com/lparuchuru-titan/skill-router"],
          ["Length", "About 2,200 words"],
        ],
        [2200, 7880],
      ),
      spacer(),

      body("A year ago, a skill library was a novelty. Now it is the default. Teams publish folders of SKILL.md files for Claude, Cursor, and every other coding agent that will read them. Salesforce teams have been early and loud about it: one skill to write Apex, another to run tests, another to deploy, another to grant field access, another to scan the diff. The library grows every week. The agent does not get better at the same rate."),
      body("The miss is not the missing skill. The miss is the prompt. A person types “add a formula field and make sure the existing permission set can see it,” and the agent either loads nothing and improvises, or loads one nearby skill and follows only half the job. Ninety good playbooks in a folder do not help if the turn loads zero of them, or loads the field skill and never the permission-set skill the prompt also asked for."),
      callout("A skill library answers “what do we know how to do?” The skill router answers “which of those does this prompt need, and which should stay on disk?”"),
      spacer(),
      body(`That second question is the whole product. The catalog measured in this repo is ${results.skills} skills. The router reads the prompt, compares it with skill names and descriptions, and returns the skills to load. A prompt about one job returns one skill. A prompt that asks for two jobs returns both. If the match is weak, it returns an empty list. Empty is a successful answer. A router that always picks something will eventually follow the wrong playbook with complete confidence.`),

      h1("A slice of a Salesforce skill library"),
      body("Here are 12 of the 19 skills in the measurement. They are short samples of those jobs, written for this repo, not the full playbooks a team would install. The other seven are general skills in the same run: unit tests, a pull-request review, an explanation, docs, a SQL query, a release, and an HTTP note. Each sample owns a narrow job. The description, and the keywords line under it, are the routing signal."),
      spacer(),
      table(
        ["Skill", "The job it owns"],
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
      body("Watch a few prompts move through the router. These lines are in eval/prompts.jsonl."),
      bullet("“Write a SOQL query for accounts created this week.” That is one job. The query skill loads. The deploy skill and the Apex skill stay on disk."),
      bullet("“Run the Apex tests and tell me the code coverage.” Coverage belongs to the skill that runs tests, not the one that writes a new test. One skill loads: platform-apex-test-run."),
      bullet("“Add a formula field for renewal date and grant field-level security on the sales permission set.” That is two jobs. The field skill and the permission-set skill both load. A prompt that only asks for the formula field loads only the field skill. The permission-set skill does not come along unless the prompt asked for access."),
      bullet("“What is a good lasagna recipe.” Nothing in the library is about dinner. The router returns nothing, and the agent does not invent an Apex procedure."),
      body("That is the help. The library can hold dozens or hundreds of skills. The prompt pays for the skills it asked for, and no others. Context stays small, the guardrails in those skills actually run, and a prompt that is not yours does not get a random playbook stapled to it."),
      ...figure(
        "01-route.png",
        "A prompt that names two jobs loads both skills. A weak match loads nothing.",
        620,
        333,
        "Figure 1. A prompt that names two jobs loads both skills. A weak match loads nothing.",
      ),

      h1("How the router helps"),
      body("Without a router, a host matches the prompt against every skill description it was given, or it matches against none and relies on the model’s memory. Both degrade as the library grows. Descriptions start to share words. The context window fills with procedures the turn will not use. The model picks a plausible skill and follows it carefully, which is worse than picking none, because the mistake is now enforced."),
      body("The router sits in front of that, as a tool the agent can call or as a one-line hint before the turn starts. It does five jobs."),
      ...figure(
        "02-library.png",
        "Most skills stay on disk. The turn loads the skills the prompt asked for.",
        620,
        333,
        "Figure 2. The catalog can be large. The turn receives only the skills this prompt needs.",
      ),
      step("It names the skills to load before any code, metadata, or query is written. The agent reads each of those SKILL.md files and follows them.", 1),
      step("It keeps the rest of the library on disk. find_skill returns the skills for this prompt, not the catalog. list_skills and read_skill exist so the agent can open exactly what was named.", 1),
      step("It prefers the word that only one skill uses. “Coverage” belongs to the test run. “SOQL” belongs to the query. “Formula field” belongs to field creation. A word that appears on many skills, such as “test,” counts for less.", 1),
      step("It stays quiet when the match is weak. The result is an empty list. The agent may answer directly. It should not pretend a skill applied.", 1),
      step("It returns one skill or several, depending on the prompt. A field change that also asks for access loads both skills. A field change that does not mention access loads only the field skill.", 1),
      spacer(),
      body("The same index is available three ways, because hosts differ. ROUTER.md is the human table. An MCP server exposes find_skill, list_skills, read_skill, search_topics, and read_topic over stdin, with no packages to install. An optional hook prints the skills to load only when it is sure, and prints nothing otherwise."),

      h1("Extending the library does not mean extending the router"),
      body("This is the part teams underestimate. Adding the next skill should be a file, not a project. The ranker does not get a new branch. You do not retrain a model. You do not edit a priority list of phrases and hope you inserted the rule in the right place."),
      ...figure(
        "03-extend.png",
        "Four steps: write the skill, rebuild the index, prove the route, then use it.",
        620,
        202,
        "Figure 3. Extending the library is a file and an eval run. The router code stays put.",
      ),
      step("Create skills/<name>/SKILL.md. The description is what the score reads. The keywords line holds the job phrases, separated by commas, in the words a person would type: formula field, field-level security. A prompt that contains one of those phrases loads this skill. The body is the procedure, and it is loaded only after the skill is chosen.", 2),
      step("If a real prompt needs two skills, do not hard-wire them together. Write the prompt so it uses both job phrases, and add that prompt to the gold set. The router loads both because the prompt asked for both.", 2),
      step("Add a gold prompt that must return this skill, and a negative if the new words could fire on an unrelated prompt. If the skill is often used beside another, add one prompt that must return both, and one prompt that must return only this skill.", 2),
      step("Regenerate the index and run the eval. If the right skills stop coming back, or an unrelated prompt starts getting a skill, the new description is overlapping a neighbor. Fix that before the next skill.", 2),
      spacer(),
      body("The router code stays put. The index is generated. A new Salesforce skill — a naming-convention check, a permission-set diff, a flow-fault reviewer — shows up in find_skill on the next prompt, because its description is now in the catalog. Removing a skill is the same operation in reverse: delete the folder, regenerate, confirm the gold prompts that used to hit it now abstain or land on the replacement."),
      body("Efficiency here is operational, not clever. The expensive work is writing a sharp description and one prompt that proves it. The cheap work is everything the router does after that. I have added skills to a live catalog this way in minutes. The sessions that went wrong were the ones where I tuned a description by reading it, skipped the gold prompt, and discovered a week later that it had stolen a neighbor’s traffic."),

      h1("The failure mode"),
      body("A skill, in the sense this router cares about, is a markdown file. The frontmatter carries a name and a description. The body carries the procedure: what to read, what to refuse, what “done” means. Hosts such as Claude Code and Cursor already match a prompt against those descriptions. That match is enough while the catalog is small."),
      body("Past a few dozen skills, two failures show up in real sessions."),
      bullet("Overlapping descriptions steal each other’s prompts. Deploy, promote, release, and pipeline all sound like the same task to a loose keyword scan, and they are different jobs with different checks."),
      bullet("The agent answers from memory when a playbook exists. The output is fluent, and it skips the guardrails the skill was written to enforce."),
      body("Putting every skill into the prompt does not fix this. The descriptions crowd each other, and the bodies blow the context window before the agent has done any work. What you want is a cheap step in front: return the skills this prompt needs, or return nothing."),

      h1("What gets indexed"),
      body("A generator walks skills/ and reads each SKILL.md. It keeps the routing signal and throws away the procedure: directory name, frontmatter name, description, and the keywords line. Multi-word job phrases come from that keywords line. Single words are also taken from the description, and they affect the score only. It writes two artifacts from the same pass."),
      bullet("router/skills-index.json is the catalog the server scores against."),
      bullet("ROUTER.md is the same catalog for a person."),
      body("The body of the skill is not in the index. That choice came from a measurement, which is in the bake-off below. The procedure is loaded later, on purpose, by a separate tool, after the route has already been decided."),
      body("If a skill ships a folder of curated notes rather than a single procedure, the generator also rebuilds a topic index for that folder. Routing still picks the skill. A second, simpler search picks the note."),

      h1("The tools"),
      body("find_skill is the call that matters. The list it returns is the set to load. Read every skill in it. The other four tools exist so the agent can open those files, instead of guessing a path."),
      spacer(),
      table(
        ["Tool", "Returns"],
        [
          ["find_skill", "Every skill this prompt needs. One skill, or several. An empty list when nothing fits. Read all of them."],
          ["list_skills", "The catalog, with an optional substring filter."],
          ["read_skill", "The full SKILL.md, so the agent follows the procedure after the route."],
          ["search_topics", "Keyword hits inside a skill’s curated notes."],
          ["read_topic", "One note, by domain and topic id."],
        ],
        [2400, 7680],
      ),
      spacer(),

      h1("How a prompt is matched"),
      body("The router does not read every skill from top to bottom before it chooses. It reads two things: the skill’s name, and the one-line description at the top of SKILL.md. That sentence is the routing signal. The rest of the file is the procedure, and it is loaded only after the skill has been chosen."),
      body("The match itself is ordinary. Which description shares the distinctive words in the prompt? “SOQL” appears on the query skill and almost nowhere else, so a SOQL question goes there. “Test” appears on the skill that writes tests and the skill that runs them, so it is a weaker clue, and “coverage” is what separates them. Words such as “the” and “for” are ignored. They show up everywhere and do not tell you which skill the person wants."),
      body("A skill joins the set when the prompt contains that skill’s job phrase. The job phrase is a multi-word entry on the keywords line, such as “formula field” or “field-level security.” One phrase, one skill. Two phrases from two skills, both skills. Words that appear only in the description do not add a second skill. If the prompt uses none of the phrases, but one skill is still clearly the best match, that one skill loads. If the best match is weak, the router returns an empty list. A question about dinner does not get an Apex skill. That cutoff is a number in the code, currently recorded in eval/results.json. You only change it by rerunning the eval after the catalog grows. You do not need the math to write a skill. You need a keywords line that uses the words a person would actually type."),
      body("The method has a name, BM25. It is the same idea a library catalog uses: a rare word is a better clue than a common one. The formula is in lib/score.mjs for anyone who wants it. The rest of this post does not depend on it."),

      h1("One prompt can need more than one skill"),
      body("A router that always returns one skill is the wrong shape. Create a field, and the permission-set skill should not come along unless the person asked for access. The prompt decides the set."),
      body(`A hand-written phrase list is still in the repo, in router/intents.json, so we can measure the older idea. The first matching phrase wins, and the second job is dropped. On this set that list puts a right skill first ${pct(scored("intent-list").recallAt1)} of the time (${scored("intent-list").recallAt1Count} of ${results.prompts.inScope}) and does not answer any of the ${results.prompts.outOfScope} unrelated prompts. It misses whenever the person does not use the exact phrase. It also misses the second skill on every prompt that needs two. The router that ships does not use that list.`),
      body(`${scored("bm25").multi} prompts in the gold set ask for two skills: a formula field plus field access, an Apex class plus its test class, a retrieve plus a deploy, a review plus a unit test, and a release checklist plus docs. The shipped router returned both skills, and no extra skill, on ${scored("bm25").multiExact} of those ${scored("bm25").multi}. A prompt that names only one of those jobs returns only that skill.`),

      h1("What we measured"),
      body(`The test set is eval/prompts.jsonl in this repo: ${results.prompts.inScope} prompts that should load one or more skills, plus ${results.prompts.outOfScope} prompts that should get no skill at all. ${results.prompts.paraphrase} of the real prompts say the job in different words than the skill description. ${scored("bm25").multi} prompts ask for two skills. node eval/compare.mjs runs every approach on those same lines and writes eval/results.json. The table below is that file, in plain terms. “Right skill first” means the strongest skill returned was one the prompt needed. “Only the skills asked for” means the list was exactly that set, with nothing extra and nothing missing. “Unrelated prompts answered” means a dinner plan or a flight search still got a Salesforce skill. The same table is in eval/results.md.`),
      spacer(),
      table(
        ["How we picked", "Right skill first", "Only the skills asked for", "Unrelated prompts answered"],
        results.rows.map((item) => [
          {
            "intent-list": "Phrase list. First match wins.",
            "token-overlap": "Count the words in common.",
            bm25: "Name and one-line description. This is what ships.",
            "bm25-body": "Name, description, and the whole skill file.",
          }[item.id],
          `${pct(item.recallAt1)} (${item.recallAt1Count} of ${results.prompts.inScope})`,
          `${pct(item.exactSet)} (${item.exactSetCount} of ${results.prompts.inScope})`,
          fires(item),
        ]),
        [3600, 2000, 2480, 2000],
      ),
      spacer(),
      body(`The shipped approach, matching the name and the one-line description, puts a needed skill first ${pct(scored("bm25").recallAt1)} of the time (${scored("bm25").recallAt1Count} of ${results.prompts.inScope}) and answers ${fires(scored("bm25"))} unrelated prompts. On those same ${results.prompts.inScope} prompts, the skills it returned were exactly the skills the prompt needed ${pct(scored("bm25").exactSet)} of the time (${scored("bm25").exactSetCount} of ${results.prompts.inScope}). Simply counting words in common ties the first-skill number on this small catalog, and then keeps returning neighboring skills the prompt did not ask for. The two also split when we search the body of the skill file.`),
      body(`Searching the whole SKILL.md answers ${fires(scored("bm25-body"))} unrelated prompts. Skill files share a lot of ordinary teaching language: “use this skill when the user…” That shared language is enough to answer a prompt that should have been left alone. The one-line description already has the words that matter. The rest of the file is for after the choice.`),
      body("This repo does not include a search that treats two differently worded sentences as the same idea, so this post does not quote one. The four rows above are the comparison you can rerun from the files in the repo."),
      callout("The body of a skill is context for doing the task. It is noise for choosing the task. Index the description. Load the body only after the skill has been chosen."),
      spacer(),

      h1("The percentage is not the whole story"),
      body(`That ${pct(scored("bm25").exactSet)} does not mean the router understands the work. All ${results.prompts.inScope - results.prompts.paraphrase} prompts that used the skills’ own words loaded exactly the skills they asked for, including the prompts that asked for two. Of the ${results.prompts.paraphrase} prompts that said the same job in different words, ${abstained} returned nothing and ${wrongSkill} returned a different skill. “The suite is red in the org. What failed?” loaded the deploy skill. The list is in eval/results.md. “Show me customers we added in the last seven days” never says SOQL, so the SOQL skill does not load.`),
      body("The fix is in the description. If people say “customers we added” and the skill only says “SOQL,” the router will miss, and it should, until their words are in the frontmatter. A description edit that helps one phrasing often steals another skill’s prompts. You will not see the theft by rereading the description. You see it when a gold prompt that used to pass starts landing on the neighbor."),
      body("That is why the test prompts are in the repo. Every skill you add comes with at least one prompt that must return it and, if the new words are broad, one prompt that must come back empty. When two skills belong in the same turn, the gold set has a prompt that must return both. node eval/run-eval.mjs asks the running server the same questions. The bar in this repo is: the skills returned are exactly the skills the prompt needed at least 80 percent of the time, and none of the unrelated prompts get a skill. The last run clears that bar. If you change a description, rerun the comparison and rebuild this post from eval/results.json. If the post and the file disagree, the file wins."),

      h1("Silence is part of the design"),
      body("Calling a tool is a choice. A hook is not. The hook sees every prompt, including dinner plans and laptop shopping, and it has to stay quiet on those. It uses the same match as the server, and it only speaks when one of the matched words is distinctive. A prompt that only shares ordinary words produces no hint."),
      body("The hook is fail-open. If the index is missing or the process throws, it prints nothing and exits 0. A hint must never block the session. It appends a small jsonl log of fires and abstains. After a week of use, read the fires for mis-routes and the highest-scoring abstains for real tasks it stayed silent on. Both become new rows in the gold set. That loop, more than the formula, is what keeps the router from rotting as the catalog grows."),

      h1("Notes, one level down"),
      body("Some skills are not procedures. They are a folder of short notes: a status-code table, a pagination note, an idempotency note. The router picks that skill the same way it picks any other skill in the set. A simpler keyword search then picks the note. The sample repo includes one such skill, a short HTTP API guide, so you can see the shape without anyone’s internal notes attached."),

      h1("Run it"),
      new Paragraph({
        spacing: { before: 0, after: 160, line: 288 },
        children: [
          run("The reference implementation is "),
          linkRun("https://github.com/lparuchuru-titan/skill-router", "github.com/lparuchuru-titan/skill-router"),
          run(`. ${results.skills} skills, the MCP server, the hook, and the eval in eval/prompts.jsonl. Wire the server into any MCP client:`),
        ],
      }),
      body("Replace the path with the real checkout. A relative path works only when the client starts in that directory."),
      ...code([
        "{",
        "  \"mcpServers\": {",
        "    \"skill-router\": {",
        "      \"command\": \"node\",",
        "      \"args\": [\"/absolute/path/to/skill-router/mcp/server.mjs\"],",
        "      \"env\": {",
        "        \"SKILL_ROUTER_ROOT\": \"/absolute/path/to/skill-router\"",
        "      }",
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
      body("Those three commands are the entire extension loop: regenerate the index, write the results, then prove the new skill did not steal a neighbor. Set SKILL_ROUTER_ROOT if the checkout is not the working directory, and SKILL_ROUTER_SKILLS_DIR if the skills live somewhere else, such as a user-level skills folder. Set SKILL_ROUTER_FLOOR when you retune."),

      h1("What I would leave out"),
      body("I would leave a vector search out until it is one of the rows in the comparison and it beats the shipped matcher on this same prompt file, including the unrelated prompts. This repo does not have that row."),
      body(`I would leave the first-match phrase list out of the choice. On the same prompts it is right ${pct(scored("intent-list").recallAt1)} of the time, and it can return only one skill, so a prompt that asks for two jobs loses the second.`),
      body("I would leave the body of the skill out of the match. Searching the whole file felt like giving the router more context. On this prompt set it created more ties and more answers to prompts that were not ours."),

      h1("The boring version is the one that works"),
      body("Skill libraries are everywhere now. The useful next step is small. An index you can regenerate. A match that sends the prompt to the skills it needs, one or more. A test file, checked in, that fails when a new skill steals a neighbor or when a two-job prompt comes back with only one. The agent loads those skills and does the work they describe. The rest of the library stays on disk. When the prompt is not one of yours, the router gets out of the way."),
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
