# Active Axiom Suppression Implementation Plan

> **For Claude:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Actively exclude overused axioms from the window AND the prompt, closing all four reinforcement channels that create the comfort zone.

**Architecture:** Three-layer suppression: (1) usage-weighted exclusion in Pool 1 stratified draw, (2) filtered AXIOM_CORPUS showing only windowed axioms' full text, (3) Condition Register axiom IDs filtered to windowed set. The "What Range Sounds Like" examples are left as-is (changing them is creative work, not code) but a note is added telling the model not to default to those axiom choices.

**Tech Stack:** Node.js (ES modules), same files as stochastic windowing

**Prior plan:** `docs/superpowers/plans/2026-02-27-stochastic-axiom-windowing.md`

---

## Diagnosis: Why Round 4 Failed

Round 4 implemented windowing (show ~42 of 105 axioms per reading). Windows worked mechanically — all 105 axioms appeared across 50 readings. But coverage *dropped* from 34.3% to 29.5%.

**Root cause:** Four reinforcement channels create a comfort zone the window doesn't break:

1. **Pool 1 includes favorites.** Stratified sampling gives each axiom ~25% chance per window. 8.4 appeared in ~13 windows and was picked every time.
2. **Condition Registers name favorites.** The prompt says "Reach for axioms of precision... (7.6, 6.6, **8.4**, 9.1, Law 3)". Even if 8.4 isn't in the windowed index, the prompt explicitly suggests it.
3. **Full AXIOM_CORPUS is always included.** All 105 axioms' full poetic text appears at the bottom. The model can quote any axiom regardless of window, making the window advisory rather than binding.
4. **"What Range Sounds Like" examples use favorites.** 5 of 7 examples use axioms that became the top 5 most cited (8.4, 6.1, 1.4, Law 4, 8.7).

**This plan closes channels 1-3 mechanically and addresses channel 4 with prompt language.**

---

## File Structure

| File | Role | Action |
|------|------|--------|
| `server.js:27-43` | AXIOM_GROUPS | Read only (reference) |
| `server.js:71-113` | `buildAxiomWindow()` | Modify (add suppression to Pool 1) |
| `server.js:257-384` | AXIOM_CORPUS | Read only (parsed at startup) |
| `server.js` (after AXIOM_CORPUS) | New: AXIOM_TEXT_MAP + buildFilteredCorpus | Add |
| `server.js:410-491` | `buildReadingPrompt()` | Modify (accept axiomIds, filter corpus + Condition Registers) |
| `server.js:494` | Backward-compat READING_PROMPT | Modify (pass all IDs) |
| `server.js:907-909` | Oracle handler windowing call | Modify (pass axiomIds to buildReadingPrompt) |
| `server.js:1080` | Exports | No change needed |
| `test-readings.js:159` | runReading windowing call | Modify (pass axiomIds to buildReadingPrompt) |

---

## Task 1: Add usage-weighted suppression to `buildAxiomWindow`

**Files:**
- Modify: `server.js:71-113` (buildAxiomWindow function)

- [ ] **Step 1: Add suppression logic to Pool 1**

Replace the current `buildAxiomWindow` function (lines 71-113) with:

```javascript
function buildAxiomWindow(diagnosticText) {
  const window = new Set();

  // Compute suppression threshold: mean + 1 stddev
  const usageValues = Object.values(axiomUsage);
  const mean = usageValues.reduce((a, b) => a + b, 0) / usageValues.length;
  const stdDev = Math.sqrt(usageValues.reduce((sum, v) => sum + (v - mean) ** 2, 0) / usageValues.length);
  const suppressionThreshold = mean + stdDev;

  // Pool 1: Stratified sample with suppression (~27)
  // 2 per group for groups with 5+ eligible axioms, 1 for smaller groups
  // Axioms above suppression threshold are excluded from the draw
  for (const group of AXIOM_GROUPS) {
    const eligible = group.ids.filter(id => axiomUsage[id] <= suppressionThreshold);
    const drawCount = eligible.length >= 5 ? 2 : (eligible.length >= 1 ? 1 : 0);
    const shuffled = shuffleArray(eligible);
    for (let i = 0; i < drawCount; i++) {
      window.add(shuffled[i]);
    }
  }

  // Pool 2: Cold boost (15 least-used axioms not already in window)
  const sortedByUsage = Object.entries(axiomUsage)
    .filter(([id]) => !window.has(id))
    .sort((a, b) => a[1] - b[1] || Math.random() - 0.5);
  for (let i = 0; i < Math.min(15, sortedByUsage.length); i++) {
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
```

**Key changes from previous version:**
1. Computes `suppressionThreshold` = mean + 1 stddev of all usage counts
2. Pool 1 filters `group.ids` to only `eligible` axioms (usage ≤ threshold) before shuffling
3. drawCount adapts: 2 if ≥5 eligible, 1 if ≥1 eligible, 0 if group fully suppressed
4. Pool 2 cold boost increased from 10 to 15

- [ ] **Step 2: Verify module loads**

Run: `node -e "import('./server.js').then(() => console.log('OK')).catch(e => console.error(e.message))"`

- [ ] **Step 3: Commit**

```bash
git add server.js
git commit -m "feat: add usage-weighted suppression to axiom windowing"
```

---

## Task 2: Filter corpus and Condition Registers to windowed axioms

**Files:**
- Modify: `server.js` (after AXIOM_CORPUS, ~line 385): add AXIOM_TEXT_MAP and buildFilteredCorpus
- Modify: `server.js:410-491` (buildReadingPrompt): accept axiomIds, use filtered corpus + filtered Condition Registers
- Modify: `server.js:494` (backward-compat READING_PROMPT): pass all axiom IDs
- Modify: `server.js:907-909` (oracle handler): pass axiomIds to buildReadingPrompt
- Modify: `test-readings.js:159` (runReading): pass axiomIds to buildReadingPrompt

- [ ] **Step 1: Parse AXIOM_CORPUS into structured map**

After the AXIOM_CORPUS closing backtick (line 384), before the PERCEPTION_PROMPT (line 386), add:

```javascript

// Parse corpus into map for filtered corpus generation
const AXIOM_TEXT_MAP = {};
for (const line of AXIOM_CORPUS.split('\n')) {
  // Match "**ID:** text" or "**ID (Name):** text"
  const match = line.match(/^\*\*(.+?)(?:\s*\(.+?\))?:\*\*\s*.+$/);
  if (match) {
    AXIOM_TEXT_MAP[match[1]] = line;
  }
}

function buildFilteredCorpus(axiomIds) {
  const idSet = new Set(axiomIds);
  return axiomIds
    .filter(id => id in AXIOM_TEXT_MAP)
    .map(id => AXIOM_TEXT_MAP[id])
    .join('\n');
}
```

- [ ] **Step 2: Update `buildReadingPrompt` to accept axiomIds and filter**

Replace the current `buildReadingPrompt` function (lines 410-492) with:

```javascript
function buildReadingPrompt(windowedIndex, axiomIds) {
  // Filter Condition Register suggestions to only windowed axioms
  const windowSet = axiomIds ? new Set(axiomIds) : null;

  function filterAxiomRefs(text) {
    if (!windowSet) return text;
    // Replace parenthetical axiom lists like "(5.5, 3.6, 4.2, Step 9 Core)"
    return text.replace(/\(([^)]+)\)/g, (match, inner) => {
      const refs = inner.split(/,\s*/);
      const filtered = refs.filter(ref => windowSet.has(ref.trim()));
      return filtered.length > 0 ? `(${filtered.join(', ')})` : '';
    });
  }

  const filteredCorpus = axiomIds ? buildFilteredCorpus(axiomIds) : AXIOM_CORPUS;

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

${filterAxiomRefs(`- When you see **drift** — name it. The commits slowed, the vision blurred, the project is coasting on momentum. Reach for axioms of endings, navigation, release (5.5, 3.6, 4.2, Step 9 Core).
- When you see **fear** — name the fear, not the feature it produced. Overengineered error handling is fear of failure. Endless abstraction is fear of commitment. Defensive architecture is fear of being wrong. Reach for axioms of courage, exposure, action (Law 7, 1.6, 11.1, 2.4).
- When you see **confusion** — don't resolve it. Reflect it back. Let the developer see their own contradiction. Reach for axioms of clarity, naming, choice (0.1, Step 10 Core, 6.1, 7.2).
- When you see **overreach** — the project trying to be everything for everyone. Name what it's drowning in. Reach for axioms of subtraction, focus, restraint (3.4, 12.1, 1.5, Step 1 Core).
- When you see **mastery through restraint** — the project that got powerful by staying small. Name what it refused to add. Reach for axioms of subtraction, discipline, focus (1.3, 3.6, 10.4, 12.1, Step 1 Core).
- When you see **mastery through endurance** — the project that outlasted its era. Name what it survived. Reach for axioms of transformation, seasons, the body's memory (4.1, 5.2, 9.5, Step 5 Core, 4.2).
- When you see **mastery through craft** — the project where every detail was considered. Name the detail that proves it. Reach for axioms of precision, the single flame, the hand's inscription (7.6, 6.6, 8.4, 9.1, Law 3).
- When you see **mastery through vision** — the project that saw what others didn't. Name what it saw first. Reach for axioms of seeing, the first word, conviction (2.7, 8.2, Law 9, 0.7, Law 1).`)}

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

The oracle has many voices. Here are fragments — not templates. Do not imitate these. Let them show you the width of the register, then find your own entry point for each project. **Do not default to the axioms shown in these examples — they are illustrations of voice, not suggestions for selection.**

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

The full text of selected axioms is below for quoting. **You may ONLY cite axioms that appear in the index above.** These texts are reference material for quoting — not a menu.

${filteredCorpus}`;
}
```

**Key changes from previous version:**
1. Accepts `axiomIds` parameter (optional, for backward compat)
2. `filterAxiomRefs()` strips Condition Register axiom IDs not in the window
3. `buildFilteredCorpus(axiomIds)` replaces full `AXIOM_CORPUS` — only windowed axioms' full text included
4. Corpus header changed from "Select only from the index above" to "You may ONLY cite axioms that appear in the index above"
5. "What Range Sounds Like" section adds: "Do not default to the axioms shown in these examples"

- [ ] **Step 3: Update backward-compat READING_PROMPT**

Replace line 494:
```javascript
const READING_PROMPT = buildReadingPrompt(AXIOM_INDEX);
```

With:
```javascript
const READING_PROMPT = buildReadingPrompt(AXIOM_INDEX, Object.keys(axiomTags));
```

- [ ] **Step 4: Update oracle handler call site**

In server.js around line 909, change:
```javascript
        const windowedPrompt = buildReadingPrompt(axiomWindow.index);
```

To:
```javascript
        const windowedPrompt = buildReadingPrompt(axiomWindow.index, axiomWindow.axiomIds);
```

- [ ] **Step 5: Update test harness call site**

In test-readings.js line 159, change:
```javascript
  const windowedPrompt = buildReadingPrompt(axiomWindow.index);
```

To:
```javascript
  const windowedPrompt = buildReadingPrompt(axiomWindow.index, axiomWindow.axiomIds);
```

- [ ] **Step 6: Verify both modules load**

Run:
```bash
node -e "import('./server.js').then(m => { const w = m.buildAxiomWindow('test conviction trajectory fear'); const p = m.buildReadingPrompt(w.index, w.axiomIds); console.log('Window:', w.axiomIds.length, 'axioms'); console.log('Prompt length:', p.length); console.log('Contains 8.4?', p.includes('8.4')); console.log('Full corpus lines:', (p.match(/^\*\*/gm) || []).length); }).catch(e => console.error(e.message))"
```

Expected:
- Window: 30-42 axioms (may be smaller now with suppression)
- Prompt length: shorter than before (filtered corpus)
- Contains 8.4?: depends on whether it's in window (with fresh usage counts, yes; after heavy use, no)
- Full corpus lines: matches window size (not 105)

- [ ] **Step 7: Commit**

```bash
git add server.js test-readings.js
git commit -m "feat: filter corpus and Condition Registers to windowed axioms"
```

---

## Task 3: Run test harness and compare Round 5 vs Round 4

**Files:**
- No code changes

- [ ] **Step 1: Reset axiom usage counts**

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
ANTHROPIC_API_KEY=<key> GITHUB_TOKEN=<token> node test-readings.js
```

- [ ] **Step 4: Compare Round 5 results to targets**

| Metric | Round 3 | Round 4 | Target | Check |
|--------|---------|---------|--------|-------|
| Axiom coverage | 34.3% | 29.5% | 55%+ | `grep "of 105 axioms cited" test-results/analysis.md` |
| Top axiom frequency | 28% | 28% (6.1) | <15% | Check first row of frequency table |
| Blind spots | 69 | 74 | ≤47 | Count "Never Cited" section |
| Window diversity | N/A | 105/105 | Present | Check "Window Diversity" section |

Also check:
- Is 8.4 still in the top 3? If suppression works, it should drop significantly.
- Are the Condition Register favorites (6.1, 8.4, Law 4) less dominant?
- Do the readings still feel good? (Suppression shouldn't hurt quality, just variety.)

- [ ] **Step 5: Commit results**

```bash
git add test-results/readings.json test-results/analysis.md axiom-usage.json
git commit -m "test: Round 5 results — active axiom suppression"
```

---

## Design Notes

**Why not change the "What Range Sounds Like" examples?** Those examples serve an important quality function — they show the model what good readings look like. Replacing them with different axioms is creative work that requires writing 7 new example readings. A prompt-language note ("Do not default to the axioms shown in these examples") is the lightweight fix. If Round 5 still shows example-axiom bias, replacing the examples becomes Task 4.

**Why filter the full corpus instead of just strengthening the instruction?** Round 4 proved that "Select only from the index above" doesn't work — the model treats the corpus as a second menu. Removing out-of-window axiom text entirely makes the constraint physical, not advisory.

**Suppression threshold (mean + 1 stddev):** With fresh counts (all 0), no axioms are suppressed — the first run behaves like Round 4. As counts accumulate during the test, overused axioms get excluded from Pool 1 within the same run. The threshold is self-correcting: when suppressed axioms' relative usage drops (because others caught up), they re-enter the pool.

**Why increase cold boost from 10 to 15?** Suppression may shrink Pool 1 (fewer eligible axioms per group). Increasing the cold boost compensates, maintaining window sizes of ~35-42.
