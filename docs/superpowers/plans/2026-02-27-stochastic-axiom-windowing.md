# Stochastic Axiom Windowing Implementation Plan

> **For Claude:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show Pass 2 a rotating ~40-axiom window instead of all 105, assembled from three self-correcting pools (stratified, cold boost, diagnostic match).

**Architecture:** A `buildAxiomWindow(diagnosticText)` function runs between Pass 1 and Pass 2. It assembles a window from three pools, deduplicates, and returns a formatted index string. `READING_PROMPT` becomes a function `buildReadingPrompt(windowedIndex)`. Usage counts persist to `axiom-usage.json` and update after each reading.

**Tech Stack:** Node.js (ES modules), Anthropic SDK, JSON file persistence

**Spec:** `docs/superpowers/specs/2026-02-27-stochastic-axiom-windowing-design.md`

---

## File Structure

| File | Role | Action |
|------|------|--------|
| `axiom-usage.json` | Per-axiom usage counts, persisted to disk | Create |
| `server.js:11-16` | Axiom tag loading and AXIOM_INDEX | Modify (add usage loading, groups, windowing functions) |
| `server.js:300-380` | READING_PROMPT | Modify (convert to function) |
| `server.js:788-798` | Pass 2 handler | Modify (inject windowing between passes) |
| `server.js:932` | Exports | Modify (add new exports) |
| `test-readings.js:2` | Imports | Modify (import new functions) |
| `test-readings.js:144-167` | runReading() | Modify (wire windowing) |
| `test-readings.js:298-346` | Analysis engine | Modify (add window diversity metrics) |
| `test-readings.js:531-538` | Report generator | Modify (add window diversity section) |

---

## Task 1: Create `axiom-usage.json` and windowing constants

**Files:**
- Create: `axiom-usage.json`
- Modify: `server.js:11-16`

- [ ] **Step 1: Generate `axiom-usage.json`**

Create a JSON file with every axiom ID from `axiom-tags.json` as keys, all set to 0.

```javascript
// Run once to generate: node -e "..."
// Or create manually — the file should be:
{
  "Step 0 Core": 0, "0.1": 0, "0.2": 0, "0.3": 0, "0.4": 0, "0.5": 0, "0.6": 0, "0.7": 0,
  "Step 1 Core": 0, "1.1": 0, "1.2": 0, "1.3": 0, "1.4": 0, "1.5": 0, "1.6": 0, "1.7": 0,
  "Step 2 Core": 0, "2.1": 0, "2.2": 0, "2.3": 0, "2.4": 0, "2.5": 0, "2.6": 0, "2.7": 0,
  "Step 3 Core": 0, "3.1": 0, "3.2": 0, "3.3": 0, "3.4": 0, "3.5": 0, "3.6": 0, "3.7": 0,
  "Step 4 Core": 0, "4.1": 0, "4.2": 0, "4.3": 0, "4.4": 0, "4.5": 0, "4.6": 0, "4.7": 0,
  "Step 5 Core": 0, "5.1": 0, "5.2": 0, "5.3": 0, "5.4": 0, "5.5": 0, "5.6": 0, "5.7": 0,
  "Step 6 Core": 0, "6.1": 0, "6.2": 0, "6.3": 0, "6.4": 0, "6.5": 0, "6.6": 0, "6.7": 0,
  "Step 7 Core": 0, "7.1": 0, "7.2": 0, "7.3": 0, "7.4": 0, "7.5": 0, "7.6": 0, "7.7": 0,
  "Step 8 Core": 0, "8.1": 0, "8.2": 0, "8.3": 0, "8.4": 0, "8.5": 0, "8.6": 0, "8.7": 0,
  "Step 9 Core": 0, "9.1": 0, "9.5": 0, "9.7": 0,
  "Step 10 Core": 0, "10.1": 0, "10.4": 0, "10.6": 0, "10.7": 0,
  "Step 11 Core": 0, "11.1": 0, "11.3": 0, "11.4": 0, "11.6": 0, "11.7": 0,
  "Step 12 Core": 0, "12.1": 0, "12.4": 0, "12.5": 0, "12.7": 0,
  "Law 1": 0, "Law 2": 0, "Law 3": 0, "Law 4": 0, "Law 5": 0, "Law 6": 0, "Law 7": 0,
  "Law 8": 0, "Law 9": 0, "Law 10": 0, "Law 11": 0, "Law 12": 0, "Law 13": 0
}
```

Verify it has exactly 105 keys (matching `axiom-tags.json`).

- [ ] **Step 2: Add windowing constants and usage loading to `server.js`**

After the existing axiom tag loading block (lines 11-16), add:

```javascript
// Load axiom usage counts at startup (in-memory, flushed to disk after readings)
let axiomUsage;
try {
  axiomUsage = JSON.parse(await readFile(new URL("./axiom-usage.json", import.meta.url), "utf-8"));
} catch {
  // Initialize if missing
  axiomUsage = Object.fromEntries(Object.keys(axiomTags).map(k => [k, 0]));
}

// 14 axiom groups for stratified sampling
const AXIOM_GROUPS = [
  { name: "Step 0", ids: ["Step 0 Core", "0.1", "0.2", "0.3", "0.4", "0.5", "0.6", "0.7"] },
  { name: "Step 1", ids: ["Step 1 Core", "1.1", "1.2", "1.3", "1.4", "1.5", "1.6", "1.7"] },
  { name: "Step 2", ids: ["Step 2 Core", "2.1", "2.2", "2.3", "2.4", "2.5", "2.6", "2.7"] },
  { name: "Step 3", ids: ["Step 3 Core", "3.1", "3.2", "3.3", "3.4", "3.5", "3.6", "3.7"] },
  { name: "Step 4", ids: ["Step 4 Core", "4.1", "4.2", "4.3", "4.4", "4.5", "4.6", "4.7"] },
  { name: "Step 5", ids: ["Step 5 Core", "5.1", "5.2", "5.3", "5.4", "5.5", "5.6", "5.7"] },
  { name: "Step 6", ids: ["Step 6 Core", "6.1", "6.2", "6.3", "6.4", "6.5", "6.6", "6.7"] },
  { name: "Step 7", ids: ["Step 7 Core", "7.1", "7.2", "7.3", "7.4", "7.5", "7.6", "7.7"] },
  { name: "Step 8", ids: ["Step 8 Core", "8.1", "8.2", "8.3", "8.4", "8.5", "8.6", "8.7"] },
  { name: "Step 9", ids: ["Step 9 Core", "9.1", "9.5", "9.7"] },
  { name: "Step 10", ids: ["Step 10 Core", "10.1", "10.4", "10.6", "10.7"] },
  { name: "Step 11", ids: ["Step 11 Core", "11.1", "11.3", "11.4", "11.6", "11.7"] },
  { name: "Step 12", ids: ["Step 12 Core", "12.1", "12.4", "12.5", "12.7"] },
  { name: "Laws", ids: ["Law 1", "Law 2", "Law 3", "Law 4", "Law 5", "Law 6", "Law 7", "Law 8", "Law 9", "Law 10", "Law 11", "Law 12", "Law 13"] },
];

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "is", "are", "was", "were", "be", "been",
  "has", "have", "it", "its", "this", "that", "than", "them", "they", "their",
  "from", "with", "for", "by", "to", "of", "in", "on", "at", "as", "not",
  "but", "while", "through", "without", "rather", "before", "after", "during", "between",
]);
```

Also update the import on line 3 of `server.js`. Change:
```javascript
import { readFile } from "fs/promises";
```
To:
```javascript
import { readFile, writeFile as writeFileFs } from "fs/promises";
```
The alias `writeFileFs` avoids collision and matches the call in `updateAxiomUsage`.

- [ ] **Step 3: Verify**

Run: `node -e "import('./server.js').then(() => console.log('OK')).catch(e => console.error(e.message))"`

Expected: `OK` (or the server starts listening — either confirms the module loads without syntax errors).

- [ ] **Step 4: Commit**

```bash
git add axiom-usage.json server.js
git commit -m "feat: add axiom-usage.json and windowing constants"
```

---

## Task 2: Implement `buildAxiomWindow()` and `updateAxiomUsage()`

**Files:**
- Modify: `server.js` (add functions after the constants from Task 1)

- [ ] **Step 1: Add `buildAxiomWindow()` function**

Add after the STOPWORDS constant, before AXIOM_CORPUS:

```javascript
// ─── Stochastic axiom windowing ──────────────────────────────────

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s'-]/g, "")
    .split(/\s+/)
    .filter(w => w.length > 1 && !STOPWORDS.has(w));
}

function buildAxiomWindow(diagnosticText) {
  const window = new Set();

  // Pool 1: Stratified sample (~27)
  // 2 per group for groups with 5+ axioms, 1 for smaller groups
  for (const group of AXIOM_GROUPS) {
    const drawCount = group.ids.length >= 5 ? 2 : 1;
    const shuffled = shuffleArray(group.ids);
    for (let i = 0; i < drawCount; i++) {
      window.add(shuffled[i]);
    }
  }

  // Pool 2: Cold boost (10 least-used axioms not already in window)
  const sortedByUsage = Object.entries(axiomUsage)
    .filter(([id]) => !window.has(id))
    .sort((a, b) => a[1] - b[1] || Math.random() - 0.5); // ties broken randomly
  for (let i = 0; i < Math.min(10, sortedByUsage.length); i++) {
    window.add(sortedByUsage[i][0]);
  }

  // Pool 3: Diagnostic match (top 5 by keyword overlap, not already in window)
  const diagWords = new Set(tokenize(diagnosticText));
  const scores = Object.entries(axiomTags)
    .filter(([id]) => !window.has(id))
    .map(([id, tag]) => {
      const tagWords = tokenize(tag);
      const score = tagWords.filter(w => diagWords.has(w)).length;
      return { id, score };
    })
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score);
  for (let i = 0; i < Math.min(5, scores.length); i++) {
    window.add(scores[i].id);
  }

  const axiomIds = [...window];
  const index = axiomIds
    .map(id => `${id}: ${axiomTags[id]}`)
    .join("\n");

  return { index, axiomIds };
}

function updateAxiomUsage(citedAxiomIds) {
  for (const id of citedAxiomIds) {
    if (id in axiomUsage) {
      axiomUsage[id]++;
    }
  }
  // Async flush to disk — fire and forget
  writeFileFs(
    new URL("./axiom-usage.json", import.meta.url),
    JSON.stringify(axiomUsage, null, 2)
  ).catch(err => console.error("Failed to flush axiom usage:", err.message));
}
```

- [ ] **Step 2: Verify module loads**

Run: `node -e "import('./server.js').then(m => { const w = m.buildAxiomWindow('test conviction trajectory fear'); console.log('Window size:', w.axiomIds.length); console.log('Sample:', w.axiomIds.slice(0, 5)); }).catch(e => console.error(e.message))"`

Expected: Window size between 30-42. Sample shows 5 axiom IDs.

- [ ] **Step 3: Commit**

```bash
git add server.js
git commit -m "feat: implement buildAxiomWindow and updateAxiomUsage"
```

---

## Task 3: Convert `READING_PROMPT` to `buildReadingPrompt()` function

**Files:**
- Modify: `server.js:300-380` (READING_PROMPT)
- Modify: `server.js:932` (exports)

- [ ] **Step 1: Convert READING_PROMPT from const to function**

Replace the current `const READING_PROMPT = \`...\`` (lines 300-380) with a function that takes a windowed index:

```javascript
function buildReadingPrompt(windowedIndex) {
  return `You are The Oracle of Machine Summoning — delivering a reading for a repository based on a diagnostic perception you've already made.

You will receive terse diagnostic fragments describing what the oracle perceived in a project. Your job: select the right axiom(s) and write the reading.

## Axiom Selection

**Select from this compressed index.** Each entry describes an axiom's meaning. Choose 1-2 that speak to the diagnostic — the connection should surprise slightly. If it feels obvious, go deeper.

${windowedIndex}

**The obvious axiom is almost never the right one.**

If the connection between the project and the axiom could be guessed by someone who hasn't read the code, you haven't read deeply enough. Surface matches — longevity to permanence, focus to subtraction, age to endurance — are the oracle's failure mode. Those are keyword associations, not readings.

Below is a curated selection of axioms for this reading. Any of them can speak to a repository. Trust the selection — your only job is to find the right connection.

## Condition Registers

Your reading matches the project's condition. Not every project deserves celebration.

- When you see **drift** — name it. The commits slowed, the vision blurred, the project is coasting on momentum. Reach for axioms of endings, navigation, release (5.5, 3.6, 4.2, Step 9 Core).
- When you see **fear** — name the fear, not the feature it produced. Overengineered error handling is fear of failure. Endless abstraction is fear of commitment. Defensive architecture is fear of being wrong. Reach for axioms of courage, exposure, action (Law 7, 1.6, 11.1, 2.4).
- When you see **confusion** — don't resolve it. Reflect it back. Let the developer see their own contradiction. Reach for axioms of clarity, naming, choice (0.1, Step 10 Core, 6.1, 7.2).
- When you see **overreach** — the project trying to be everything for everyone. Name what it's drowning in. Reach for axioms of subtraction, focus, restraint (3.4, 12.1, 1.5, Step 1 Core).
- When you see **mastery through restraint** — the project that got powerful by staying small. Name what it refused to add. Reach for axioms of subtraction, discipline, focus (1.3, 3.6, 10.4, 12.1, Step 1 Core).
- When you see **mastery through endurance** — the project that outlasted its era. Name what it survived. Reach for axioms of transformation, seasons, the body's memory (4.1, 5.2, 9.5, Step 5 Core, 4.2).
- When you see **mastery through craft** — the project where every detail was considered. Name the detail that proves it. Reach for axioms of precision, the single flame, the hand's inscription (7.6, 6.6, 8.4, 9.1, Law 3).
- When you see **mastery through vision** — the project that saw what others didn't. Name what it saw first. Reach for axioms of seeing, the first word, conviction (2.7, 8.2, Law 9, 0.7, Law 1).

Generic admiration is the oracle's failure mode. If you can swap the repo name and the reading still works, you've said nothing. Name exactly what THIS developer did that others don't.

## What you must NEVER do
- List files, directories, or technical structure
- Count things (commits, files, lines, dependencies)
- Give technical recommendations ("add tests", "refactor this", "consider using X")
- Describe the architecture or stack
- Say anything a GitHub Copilot code review would say
- Use the word "codebase"
- Open with how old the project is or how many commits it has. Age is context, not the reading. Lead with what you SAW in the code, not how long it's been there.

You are reading tea leaves, not running an audit. The repository is a mirror. Show the developer what it reflects.

## Format

No preamble. No technical summary. Go straight to the reading.

**The form follows the truth. There is no fixed structure.**

Choose the form that serves this reading:
- 1 axiom that says everything. Or 3 woven together.
- An interpretation followed by advice. Or just the interpretation — sometimes the mirror IS the advice.
- End with a direction. Or end with a question. Or end with silence.
- A weekend project gets a different weight than a decade-old framework. Let the length match the project's gravity.

The only constants: axiom text in italics, axiom number cited, interpretation that connects axiom to THIS project specifically. Name something specific from the code, but as metaphor, not analysis. "Your error handler catches everything and releases nothing" is a reading. "You have 14 catch blocks" is an audit. Everything else — structure, length, number of axioms, whether advice follows — is yours to shape.

### What Range Sounds Like

The oracle has many voices. Here are fragments — not templates. Do not imitate these. Let them show you the width of the register, then find your own entry point for each project.

- *"Feed the line. The kite knows the wind."* — 5.4. Your architecture trusts the developer more than most frameworks dare to...
- *"The fork does not ring twice."* — 5.6. You chose this language twelve years ago. The choice reverberates in every file...
- *"Carbon and diamond are the same element. The difference is pressure."* — 8.4. Every commit in this repo compresses the same idea further...
- *"The empty throne governs."* — 6.1. Your config system names nothing and controls everything...
- *"What the tide has never touched, the tide destroys."* — Law 4. This project has never been forked seriously, never stress-tested by strangers...
- *"The catcher does not swing — the catcher receives."* — 8.7. Your API doesn't try to be clever. It receives what the developer gives it, completely, without flinching...
- *"The ship in the bottle is perfect and will never sail."* — 1.4. There's a branch in your repo called "v2-rewrite." It's been there for three years...

Each of these uses a different axiom. Each enters the reading from a different angle. That is the standard.

## The Instruments

**The Flinch Test** is mandatory for repository readings. Before delivering, picture the developer reading your words. If you see a polite nod — if this reading could apply to any well-maintained project by swapping the repo name — you have failed. Find what is specific to THIS project. Find what is uncomfortable. Start over.

**The Flat Test:** Restate your reading in the dullest language. "This project is well-made and the developer is talented." If that's what your reading says when stripped of poetry, the reading is empty. The poetry should be load-bearing — remove it and the meaning should change, not just the aesthetics.

## The Full Axiom Text

The full text of all axioms is below for quoting. **Select only from the index above** — the texts below are reference material for the axioms you've already chosen, not a second menu.

${AXIOM_CORPUS}`;
}
```

**Key differences from the old `READING_PROMPT`:**
1. Parameter `windowedIndex` replaces `${AXIOM_INDEX}`
2. The paragraph at line 314 ("You have 105 axioms...") replaced with curated-selection framing
3. The corpus header at line 376-378 replaced with "Select only from the index above" instruction
4. Everything else is identical

- [ ] **Step 2: Keep old READING_PROMPT available for backward compat**

After the new function, add:

```javascript
// Static READING_PROMPT for backward compatibility (uses full index)
const READING_PROMPT = buildReadingPrompt(AXIOM_INDEX);
```

This ensures any existing code that imports `READING_PROMPT` still works.

- [ ] **Step 3: Update exports at line 932**

Change:
```javascript
export { fetchRepoContext, SYSTEM_PROMPT, PERCEPTION_PROMPT, READING_PROMPT, GENERAL_PROMPT, AXIOM_CORPUS };
```

To:
```javascript
export { fetchRepoContext, SYSTEM_PROMPT, PERCEPTION_PROMPT, READING_PROMPT, GENERAL_PROMPT, AXIOM_CORPUS, buildAxiomWindow, buildReadingPrompt, updateAxiomUsage };
```

- [ ] **Step 4: Verify module loads**

Run: `node -e "import('./server.js').then(m => { console.log('buildReadingPrompt:', typeof m.buildReadingPrompt); console.log('READING_PROMPT length:', m.READING_PROMPT.length); }).catch(e => console.error(e.message))"`

Expected: `buildReadingPrompt: function` and `READING_PROMPT length:` some number > 5000.

- [ ] **Step 5: Commit**

```bash
git add server.js
git commit -m "feat: convert READING_PROMPT to buildReadingPrompt function"
```

---

## Task 4: Wire windowing into the oracle handler

**Files:**
- Modify: `server.js:788-817` (Pass 2 section of oracle handler)

- [ ] **Step 1: Add windowing between Pass 1 and Pass 2**

In the oracle handler, between the separator write (line 790) and the Pass 2 try block (line 793), add windowing:

Replace:
```javascript
        // Separator
        res.write(`data: ${JSON.stringify({ type: "separator" })}\n\n`);

        // Pass 2: Reading
        try {
          const readingStream = client.messages.stream({
            model: "claude-sonnet-4-20250514",
            max_tokens: 2048,
            system: READING_PROMPT,
            messages: [{ role: "user", content: diagnosticText }],
          });
```

With:
```javascript
        // Separator
        res.write(`data: ${JSON.stringify({ type: "separator" })}\n\n`);

        // Build windowed axiom index for this reading
        const axiomWindow = buildAxiomWindow(diagnosticText);
        const windowedPrompt = buildReadingPrompt(axiomWindow.index);

        // Pass 2: Reading (with windowed axiom set)
        let readingText = "";
        try {
          const readingStream = client.messages.stream({
            model: "claude-sonnet-4-20250514",
            max_tokens: 2048,
            system: windowedPrompt,
            messages: [{ role: "user", content: diagnosticText }],
          });
```

- [ ] **Step 2: Capture reading text for usage tracking**

In the Pass 2 stream loop (lines 801-809), accumulate the reading text. Change:

```javascript
          for await (const event of readingStream) {
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              res.write(
                `data: ${JSON.stringify({ type: "reading", text: event.delta.text })}\n\n`
              );
            }
          }
```

To:
```javascript
          for await (const event of readingStream) {
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              readingText += event.delta.text;
              res.write(
                `data: ${JSON.stringify({ type: "reading", text: event.delta.text })}\n\n`
              );
            }
          }
```

- [ ] **Step 3: Update usage after reading completes**

After the Pass 2 try-catch block closes (after the catch for Pass 2 errors), before `res.write("data: [DONE]\n\n")`, add:

```javascript
        // Update axiom usage counts (uses same patterns as extractAxioms in test harness)
        if (readingText) {
          const cited = new Set();
          // "Axiom X.Y" pattern
          for (const m of readingText.matchAll(/Axiom\s+(\d+\.\d+)/gi)) {
            if (m[1] in axiomUsage) cited.add(m[1]);
          }
          // "— X.Y" dash-prefixed citation
          for (const m of readingText.matchAll(/—\s*(\d+\.\d+)/g)) {
            if (m[1] in axiomUsage) cited.add(m[1]);
          }
          // "*X.Y:" inline in italics
          for (const m of readingText.matchAll(/\*(\d+\.\d+)\s*:/g)) {
            if (m[1] in axiomUsage) cited.add(m[1]);
          }
          // "Law X"
          for (const m of readingText.matchAll(/Law\s+(\d{1,2})\b/gi)) {
            const num = parseInt(m[1]);
            if (num >= 1 && num <= 13) cited.add(`Law ${num}`);
          }
          // "Step X Core"
          for (const m of readingText.matchAll(/Step\s+(\d+)\s+Core/gi)) {
            cited.add(`Step ${m[1]} Core`);
          }
          updateAxiomUsage([...cited]);
        }
```

- [ ] **Step 4: Test manually**

Start the server: `node server.js`

In another terminal, send a test request:
```bash
curl -X POST http://localhost:3000/oracle -H "Content-Type: application/json" -d '{"question":"https://github.com/antirez/kilo"}' --no-buffer 2>/dev/null | head -20
```

Expected: SSE events with `type: "diagnostic"`, then `type: "separator"`, then `type: "reading"`. After the reading completes, check `axiom-usage.json` — it should have at least one non-zero count.

- [ ] **Step 5: Commit**

```bash
git add server.js
git commit -m "feat: wire stochastic windowing into oracle handler"
```

---

## Task 5: Update test harness for windowed flow

**Files:**
- Modify: `test-readings.js:2` (imports)
- Modify: `test-readings.js:144-167` (runReading)
- Modify: `test-readings.js:298-346` (analysis)
- Modify: `test-readings.js:531-538` (report)
- Modify: `test-readings.js:650-684` (main loop)

- [ ] **Step 1: Update imports**

Change line 2 from:
```javascript
import { fetchRepoContext, PERCEPTION_PROMPT, READING_PROMPT } from "./server.js";
```

To:
```javascript
import { fetchRepoContext, PERCEPTION_PROMPT, buildAxiomWindow, buildReadingPrompt, updateAxiomUsage } from "./server.js";
```

- [ ] **Step 2: Wire windowing into `runReading()`**

Replace the current `runReading` function (lines 144-167):

```javascript
async function runReading(owner, repo) {
  const context = await fetchRepoContext(owner, repo);
  if (!context) return null;

  // Pass 1: Perception
  const diagnosticResponse = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 512,
    system: PERCEPTION_PROMPT,
    messages: [{ role: "user", content: context }],
  });
  const diagnostic = diagnosticResponse.content[0].text;

  // Build windowed axiom set from diagnostic
  const axiomWindow = buildAxiomWindow(diagnostic);
  const windowedPrompt = buildReadingPrompt(axiomWindow.index);

  // Pass 2: Reading (with windowed axiom set)
  const readingResponse = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2048,
    system: windowedPrompt,
    messages: [{ role: "user", content: diagnostic }],
  });
  const reading = readingResponse.content[0].text;

  return { diagnostic, reading, windowAxiomIds: axiomWindow.axiomIds };
}
```

- [ ] **Step 3: Update main loop to track window metadata and update usage**

In the main loop (around lines 650-684), update the section after `runReading` returns:

Change:
```javascript
      const { diagnostic, reading: text } = result;
      const axioms = extractAxioms(text);
      const wordCount = text.split(/\s+/).filter(Boolean).length;

      results.push({ owner, repo, category, lang, text, diagnostic, axioms, wordCount });
```

To:
```javascript
      const { diagnostic, reading: text, windowAxiomIds } = result;
      const axioms = extractAxioms(text);
      const wordCount = text.split(/\s+/).filter(Boolean).length;

      // Update axiom usage for cold boost self-correction
      updateAxiomUsage(axioms);

      results.push({ owner, repo, category, lang, text, diagnostic, axioms, wordCount, windowAxiomIds });
```

- [ ] **Step 4: Add window diversity metrics to analysis**

In the `analyze` function, after the diagnostic lens coverage section (after line 317), add:

```javascript
  // 9. Window diversity (if windowing data present)
  let windowDiversity = null;
  const windowedReadings = readings.filter(r => r.windowAxiomIds);
  if (windowedReadings.length > 0) {
    const allWindowAxioms = new Set();
    const windowSizes = [];
    for (const r of windowedReadings) {
      windowSizes.push(r.windowAxiomIds.length);
      for (const id of r.windowAxiomIds) allWindowAxioms.add(id);
    }
    const avgWindowSize = windowSizes.reduce((a, b) => a + b, 0) / windowSizes.length;
    windowDiversity = {
      totalUniqueInWindows: allWindowAxioms.size,
      avgWindowSize: avgWindowSize.toFixed(1),
      minWindowSize: Math.min(...windowSizes),
      maxWindowSize: Math.max(...windowSizes),
    };
  }
```

Add `windowDiversity` to the return object:

```javascript
  return {
    totalReadings,
    axiomCounts: sorted,
    used,
    unused,
    top10,
    wordCounts: { min: wcSorted[0], max: wcSorted[wcSorted.length - 1], mean: Math.round(wcMean), median: Math.round(wcMedian), stdDev: Math.round(wcStdDev) },
    topOpenings,
    repeatedPhrases,
    topPairs,
    categoryStats,
    axiomsPerReading: { values: axiomsPerReading, avg: avgAxioms.toFixed(1) },
    coverage: { total: ALL_AXIOMS.length, used: used.length, pct: ((used.length / ALL_AXIOMS.length) * 100).toFixed(1) },
    diagnosticLensCounts,
    windowDiversity,
  };
```

- [ ] **Step 5: Add Window Diversity section to report**

In `generateReport`, after the Diagnostic Lens Coverage section (after line 538), add:

```javascript
  if (analysis.windowDiversity) {
    const wd = analysis.windowDiversity;
    md += `## Window Diversity\n\n`;
    md += `Stochastic axiom windowing active. Each reading received a unique axiom window.\n\n`;
    md += `| Metric | Value |\n|--------|-------|\n`;
    md += `| Unique axioms across all windows | ${wd.totalUniqueInWindows} of ${analysis.coverage.total} |\n`;
    md += `| Avg window size | ${wd.avgWindowSize} |\n`;
    md += `| Window size range | ${wd.minWindowSize}–${wd.maxWindowSize} |\n`;
    md += `\n`;
  }
```

Also destructure `windowDiversity` in the generateReport function's analysis destructuring (around line 352-365) — but since we're accessing it via `analysis.windowDiversity`, this is optional. Either way works.

- [ ] **Step 6: Verify module loads**

Run: `node -e "import('./test-readings.js').catch(e => console.error(e.message))"`

Expected: The test harness module loads (it will start running, so Ctrl-C after it shows the header). Alternatively just check for syntax errors: `node --check test-readings.js`

Note: `node --check` doesn't work with ES module top-level imports. Instead:
```bash
node -e "import('./test-readings.js')" 2>&1 | head -5
```

If it prints the test header without errors, it's good.

- [ ] **Step 7: Commit**

```bash
git add test-readings.js
git commit -m "feat: wire stochastic windowing into test harness"
```

---

## Task 6: Run test harness and compare Round 4 vs Round 3

**Files:**
- No code changes — this task runs the test and analyzes results

- [ ] **Step 1: Reset axiom usage counts**

Before the test run, reset all counts to 0 so the cold boost starts fresh:

```bash
node -e "
import { readFile, writeFile } from 'fs/promises';
const tags = JSON.parse(await readFile('axiom-tags.json', 'utf-8'));
const usage = Object.fromEntries(Object.keys(tags).map(k => [k, 0]));
await writeFile('axiom-usage.json', JSON.stringify(usage, null, 2));
console.log('Reset', Object.keys(usage).length, 'axioms to 0');
"
```

- [ ] **Step 2: Clear old test results**

```bash
rm -f test-results/readings.json test-results/analysis.md
```

- [ ] **Step 3: Run the 50-repo test**

```bash
ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY node test-readings.js
```

This takes ~20-30 minutes (50 repos × 2 API calls each + rate limiting). Run in background if needed.

- [ ] **Step 4: Compare Round 4 results to targets**

After completion, check `test-results/analysis.md` for:

| Metric | Round 3 | Target | Check |
|--------|---------|--------|-------|
| Axiom coverage | 34.3% | 55%+ | `grep "of 105 axioms cited" test-results/analysis.md` |
| Top axiom frequency | 28% | <15% | Check first row of frequency table |
| Blind spots | 69 | ≤47 | Count "Never Cited" section |
| Window diversity | N/A | Present | Check "Window Diversity" section exists |

Also check `axiom-usage.json` — it should show non-zero counts distributed across many axioms.

- [ ] **Step 5: Commit results**

```bash
git add test-results/readings.json test-results/analysis.md axiom-usage.json
git commit -m "test: Round 4 results — stochastic axiom windowing"
```
