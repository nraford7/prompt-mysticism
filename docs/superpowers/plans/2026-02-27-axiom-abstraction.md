# Axiom Abstraction: Deferred Revelation — Implementation Plan

> **For Claude:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the oracle into two passes — perception then reading — so the model selects axioms by semantic meaning, not by poetic imagery.

**Architecture:** Two sequential Claude API calls per repo reading. Pass 1 streams a terse diagnostic (no axioms visible). Pass 2 receives the diagnostic + compressed axiom index (semantic tags) + full axiom corpus, then streams the reading. Frontend shows both passes with distinct visual treatment. Non-repo queries stay single-pass.

**Tech Stack:** Node.js, Anthropic SDK (`@anthropic-ai/sdk`), claude-sonnet-4-20250514

**Spec:** `docs/superpowers/specs/2026-02-27-axiom-abstraction-design.md`

---

## File Structure

| File | Change | Responsibility |
|------|--------|---------------|
| `generate-tags.js` | Create | Build script: parse axioms from server.js, call Claude to generate semantic tags, write to axiom-tags.json |
| `axiom-tags.json` | Create | 105 compressed semantic tags (one sentence each, no metaphor) |
| `server.js` | Modify | Split SYSTEM_PROMPT into 3 prompts; two-pass API flow; load axiom tags; updated share handler |
| `public/index.html` | Modify | SSE handler for typed events; diagnostic rendering; share feature updates |
| `test-readings.js` | Modify | Handle two-pass flow via direct API calls (not SSE); capture diagnostic + reading |

---

## Chunk 1: Tag Generation

### Task 1: Create generate-tags.js

**Files:**
- Create: `generate-tags.js`
- Read: `server.js` (to understand axiom format in SYSTEM_PROMPT, lines 267-396)

The script parses all 105 axiom entries from the SYSTEM_PROMPT export in server.js. It calls Claude to generate a one-sentence semantic paraphrase for each. Output writes to `axiom-tags.json`.

- [ ] **Step 1: Write the axiom parser**

Create `generate-tags.js`. Import the `SYSTEM_PROMPT` from `server.js`. Parse out every axiom entry — each follows the pattern `**ID:** Text` or `**ID (Name):** Text`. Extract all 105 entries (79 numbered axioms + 13 Step Cores + 13 Law Cores).

```javascript
import Anthropic from "@anthropic-ai/sdk";
import { writeFile } from "fs/promises";
import { SYSTEM_PROMPT } from "./server.js";

const client = new Anthropic();

// Parse axioms from SYSTEM_PROMPT
function parseAxioms(prompt) {
  const axioms = [];
  // Match patterns like: **Step 0 Core (Divinatio):** Text
  //                       **0.1:** Text
  //                       **Law 1 (Assess):** Text
  const re = /\*\*((?:Step \d+ Core|Law \d+|\d+\.\d+)(?:\s*\([^)]*\))?)\s*:\*\*\s*(.+)/g;
  let match;
  while ((match = re.exec(prompt)) !== null) {
    // Strip parenthetical names: "Step 0 Core (Divinatio)" -> "Step 0 Core"
    const id = match[1].replace(/\s*\([^)]*\)/, "").trim();
    const text = match[2].trim();
    axioms.push({ id, text });
  }
  return axioms;
}

async function generateTags(axioms) {
  const axiomList = axioms
    .map((a) => `${a.id}: ${a.text}`)
    .join("\n");

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: `You are creating a compressed semantic index for an oracle system. For each axiom below, write a one-sentence paraphrase that captures the MEANING, not the imagery.

Rules:
- One sentence, under 15 words
- Describe what the axiom MEANS, not what it depicts
- No metaphor — no glacier, marble, forge, river, fire, blade, etc.
- Each tag must be distinct from every other tag
- Use plain, precise language

Format your response as JSON: { "axiom_id": "semantic tag", ... }

Axioms:
${axiomList}`,
      },
    ],
  });

  const text = response.content[0].text;
  // Extract JSON from response (may be wrapped in markdown code block)
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON found in response");
  return JSON.parse(jsonMatch[0]);
}

async function main() {
  const axioms = parseAxioms(SYSTEM_PROMPT);
  console.log(`Parsed ${axioms.length} axioms from SYSTEM_PROMPT`);

  if (axioms.length !== 105) {
    console.warn(`WARNING: Expected 105 axioms, found ${axioms.length}`);
  }

  console.log("Generating semantic tags via Claude...");
  const tags = await generateTags(axioms);

  const tagCount = Object.keys(tags).length;
  console.log(`Generated ${tagCount} tags`);

  // Check for missing axioms
  const missing = axioms.filter((a) => !tags[a.id]);
  if (missing.length > 0) {
    console.warn(`Missing tags for: ${missing.map((a) => a.id).join(", ")}`);
  }

  await writeFile("axiom-tags.json", JSON.stringify(tags, null, 2));
  console.log("Written to axiom-tags.json");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
```

- [ ] **Step 2: Run the generator**

```bash
export $(cat .env | xargs) && node generate-tags.js
```

Expected: "Parsed 105 axioms from SYSTEM_PROMPT" → "Generated 105 tags" → "Written to axiom-tags.json"

- [ ] **Step 3: Verify the output**

Read `axiom-tags.json`. Check:
- Exactly 105 entries
- Every entry under 15 words
- No poetic imagery in the tags (no "glacier", "marble", "forge", "river", "fire", "blade")
- Tags are distinct from each other

If any tags are bad (too vague, contain metaphor, or duplicate another), edit them manually.

- [ ] **Step 4: Commit**

```bash
git add generate-tags.js axiom-tags.json
git commit -m "Tag generation: 105 compressed semantic axiom tags"
```

---

## Chunk 2: Server Two-Pass Architecture

### Task 2: Split SYSTEM_PROMPT into Three Prompts

**Files:**
- Modify: `server.js:139-396` (SYSTEM_PROMPT) and `server.js:568` (export)

Split the monolithic SYSTEM_PROMPT into three prompts. The split boundaries are defined in the spec.

- [ ] **Step 1: Create PERCEPTION_PROMPT**

Add a new constant `PERCEPTION_PROMPT` above `SYSTEM_PROMPT`. It includes:
- The oracle identity paragraph (current line 139: "You are The Oracle..." through line 143)
- The "Repository Readings (Gitomancy)" section header and "How to Read a Repository" intro (lines 179-186)
- The 7 diagnostic lenses (lines 187-197, ending with "Read the whole picture — trajectory AND character — before reaching for the axiom.")
- New instructions appended: the terse-fragment voice directive and the "no axioms" constraint

```javascript
const PERCEPTION_PROMPT = `You are The Oracle of Machine Summoning. You read the soul of a project, not its résumé.

You will receive a repository's metadata, file tree, commit history, and source code. Read the project through these lenses:

1. **Trajectory** — Is this project ascending, plateauing, or declining? The commits tell you. Is the developer sprinting, maintaining, or drifting? Did they start bold and lose nerve, or start timid and find courage?
2. **Conviction** — Is the developer building from passion or from habit? Is this code alive with intent, or running on momentum? The difference shows in the commits — are they solving problems or checking boxes?
3. **Avoidance** — What is this project afraid of? What does it refuse to confront? Every project has a shadow — the test it won't write, the refactor it won't start, the dependency it clings to, the question it won't ask.
4. **The Gap** — What's the distance between what the README promises and what the code delivers? Is the project honest about what it is? The README is the project's self-image. The code is its body. Read the distance between them.
5. **Fragility** — What could kill this project? A maintainer leaving? A dependency breaking? The market moving on? Name the thing that holds it together, and you've named the thing that could break it.
6. **Aesthetic** — What does this code value? Readability over cleverness? Performance over clarity? Minimalism or completeness? The style reveals the developer's philosophy more honestly than any manifesto. Read the variable names, the error messages, the comments they chose to write. That's the voice.
7. **Relationship** — How does this project treat the people who use it? Does the documentation welcome or gatekeep? Is the API an invitation or a contract? Does the README speak to beginners or assume expertise? The project's relationship to its users reveals its relationship to itself.

## Your Output

Deliver terse oracle fragments — compressed, evocative impressions. Not clinical analysis, not full prose. You are perceiving, not prescribing.

Cover all seven lenses, but don't label them. Weave your perception into a single flow of fragments. Short. Evocative. The reader should feel the oracle's eye moving across the project.

Do NOT:
- Mention axiom numbers or axiom text
- Select or recommend axioms
- Give technical analysis or recommendations
- Write full sentences about the project — use fragments, impressions, compressed observations`;
```

- [ ] **Step 2: Extract AXIOM_CORPUS as a shared constant**

The axiom text (lines 267-396 of current server.js, from "### Phase I — Intelligence Gathering" through "**Law 13 (Monitor):** See. Do. See again. The whole practice in three words.") is needed by both READING_PROMPT and GENERAL_PROMPT. Extract it into a named constant.

In server.js, find the axiom section of SYSTEM_PROMPT and extract it into a constant defined before the prompts:

```javascript
// The full axiom text — shared by READING_PROMPT and GENERAL_PROMPT
const AXIOM_CORPUS = `### Phase I — Intelligence Gathering

**Step 0 Core (Divinatio):** The wound asks. The scar answers. Between them, the blood of all you chose not to know.
**0.1:** The flood contains the river. The river moves the world. To name is to refuse the flood.
...
**Law 13 (Monitor):** See. Do. See again. The whole practice in three words.`;
```

The implementer must copy lines 269-396 from the current SYSTEM_PROMPT verbatim into this constant. It is ~130 lines / ~3500 words. Do not abbreviate or summarize — the model needs the exact axiom text for quoting.

- [ ] **Step 3: Create READING_PROMPT**

Add a new constant `READING_PROMPT`. It receives the diagnostic as input and includes:
- Axiom selection guidance (with "208" fixed to "105")
- The condition-matching registers
- The NEVER list
- Format instructions
- The Instruments — Flinch Test and Flat Test
- The compressed axiom index (loaded from axiom-tags.json)
- The full axiom corpus via `${AXIOM_CORPUS}`

The READING_PROMPT is built at startup by loading `axiom-tags.json` and interpolating it into the prompt string.

```javascript

// Load axiom tags at startup
const axiomTags = JSON.parse(await readFile(new URL("./axiom-tags.json", import.meta.url), "utf-8"));

const AXIOM_INDEX = Object.entries(axiomTags)
  .map(([id, tag]) => `${id}: ${tag}`)
  .join("\n");

const READING_PROMPT = `You are The Oracle of Machine Summoning — delivering a reading for a repository based on a diagnostic perception you've already made.

You will receive terse diagnostic fragments describing what the oracle perceived in a project. Your job: select the right axiom(s) and write the reading.

## Axiom Selection

**Select from this compressed index.** Each entry describes an axiom's meaning. Choose 1-2 that speak to the diagnostic — the connection should surprise slightly. If it feels obvious, go deeper.

${AXIOM_INDEX}

**The obvious axiom is almost never the right one.**

If the connection between the project and the axiom could be guessed by someone who hasn't read the code, you haven't read deeply enough. Surface matches — longevity to permanence, focus to subtraction, age to endurance — are the oracle's failure mode. Those are keyword associations, not readings.

You have 105 axioms. Every one of them can speak to a repository. If you've been reaching for the same handful, you've stopped listening.

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

Use these for quoting in your reading. Cite in italics with axiom number.

${AXIOM_CORPUS}`;
```

- [ ] **Step 4: Create GENERAL_PROMPT**

`GENERAL_PROMPT` is used for non-repo queries (no GitHub URL detected). It keeps the current SYSTEM_PROMPT's general oracle behavior — the "How to Respond" section, Voice section, and full axiom corpus via `${AXIOM_CORPUS}` — but drops all repo-specific sections.

Note: The current SYSTEM_PROMPT says "208 axioms" in its opening line. The GENERAL_PROMPT corrects this — the line below says "105 axioms" instead.

```javascript
const GENERAL_PROMPT = `You are The Oracle of Machine Summoning — an ambient companion drawn from 105 axioms that survived 7 waves of evolution and ~10,000 mutations. The axioms began as prompting instructions for working with AI and evolved into wisdom about attention, clarity, commitment, and action.

Someone has come to you with a situation — a problem they're working on, a place they're stuck, something they're building or holding. Your role is to read their situation and offer guidance drawn from the axioms.

The oracle arrives neutral. Not admiring, not suspicious — empty. It reads first and lets the situation set the tone.

## How to Respond

1. **Read the situation.** Understand what they're actually dealing with — not just the surface question, but the underlying tension.

2. **Select 1-2 axioms** that speak to their situation. Choose the ones that will land hardest, not the most obvious ones.

3. **Deliver the reading** in this format:

---

**The Reading**

*[Full axiom text in italics]*

— Axiom [number]

[2-4 sentences INTERPRETING the axiom through the lens of their situation.]

---

**The Advice**

*[Second axiom — number and core phrase in italics]*

[1-2 sentences of plain, direct, actionable advice.]

## Voice

- Oracular but not pretentious. Direct but not cold.
- You see through the question to the real issue.
- Short. Every word carries weight. If you can say it in fewer words, do.
- Never explain the axioms abstractly. Always connect them to THIS person's THIS situation.

## The Axioms

${AXIOM_CORPUS}`;
```

- [ ] **Step 5: Update the export**

Replace the current export line:

```javascript
export { fetchRepoContext, SYSTEM_PROMPT };
```

With:

```javascript
export { fetchRepoContext, SYSTEM_PROMPT, PERCEPTION_PROMPT, READING_PROMPT, GENERAL_PROMPT, AXIOM_CORPUS };
```

Keep `SYSTEM_PROMPT` exported for backward compatibility (test harness may reference it during transition).

- [ ] **Step 6: Commit**

```bash
git add server.js
git commit -m "Prompts: split SYSTEM_PROMPT into PERCEPTION, READING, and GENERAL"
```

---

### Task 3: Implement Two-Pass API Flow

**Files:**
- Modify: `server.js:425-497` (the `/oracle` POST handler)

Replace the single API call with the two-pass flow for repo queries. Non-repo queries use GENERAL_PROMPT with a single call.

- [ ] **Step 1: Rewrite the oracle handler for repo queries**

When a GitHub URL is detected (`repoMatch` is truthy and `repoContext` is available), run the two-pass flow:

```javascript
// Inside the try block of the /oracle handler, replace from line 462 onward:

res.writeHead(200, {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache",
  Connection: "keep-alive",
});

if (repoMatch && repoContext) {
  // === TWO-PASS FLOW ===

  // Pass 1: Perception
  let diagnosticText = "";
  try {
    const diagnosticStream = client.messages.stream({
      model: "claude-sonnet-4-20250514",
      max_tokens: 512,
      system: PERCEPTION_PROMPT,
      messages: [{ role: "user", content: repoContext }],
    });

    for await (const event of diagnosticStream) {
      if (
        event.type === "content_block_delta" &&
        event.delta.type === "text_delta"
      ) {
        diagnosticText += event.delta.text;
        res.write(
          `data: ${JSON.stringify({ type: "diagnostic", text: event.delta.text })}\n\n`
        );
      }
    }
  } catch (err) {
    console.error("Pass 1 error:", err.message);
    if (diagnosticText) {
      // Mid-stream failure
      res.write(
        `data: ${JSON.stringify({ type: "error", text: "The oracle's perception faltered." })}\n\n`
      );
    } else {
      // Pre-stream failure
      res.write(
        `data: ${JSON.stringify({ type: "error", text: "The oracle could not perceive." })}\n\n`
      );
    }
    res.write("data: [DONE]\n\n");
    res.end();
    return;
  }

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
  } catch (err) {
    console.error("Pass 2 error:", err.message);
    res.write(
      `data: ${JSON.stringify({ type: "error", text: "The oracle saw clearly but could not speak." })}\n\n`
    );
  }

  res.write("data: [DONE]\n\n");
  res.end();

} else {
  // === SINGLE-PASS FLOW (non-repo queries) ===
  const stream = client.messages.stream({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    system: GENERAL_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  });

  for await (const event of stream) {
    if (
      event.type === "content_block_delta" &&
      event.delta.type === "text_delta"
    ) {
      res.write(`data: ${JSON.stringify({ type: "reading", text: event.delta.text })}\n\n`);
    }
  }

  res.write("data: [DONE]\n\n");
  res.end();
}
```

- [ ] **Step 2: Update the share handler**

In the `/readings` POST handler (current line 502), add `diagnostic` to the stored object:

```javascript
readings.set(id, {
  repoName: data.repoName || null,
  repoUrl: data.repoUrl || null,
  diagnostic: data.diagnostic || null,
  reading: data.reading,
  createdAt: Date.now(),
});
```

- [ ] **Step 3: Verify server starts**

```bash
export $(cat .env | xargs) && node server.js
```

Expected: "Oracle proxy listening on port 3000"

Test manually with a curl:
```bash
curl -X POST http://localhost:3000/oracle -H "Content-Type: application/json" -d '{"question":"https://github.com/antirez/kilo"}' 2>/dev/null | head -20
```

Expected: SSE events with `"type": "diagnostic"` followed by `"type": "separator"` followed by `"type": "reading"`.

- [ ] **Step 4: Commit**

```bash
git add server.js
git commit -m "Server: two-pass API flow with error handling and updated share handler"
```

---

## Chunk 3: Frontend, Test Harness, and Verification

### Task 4: Update Frontend SSE Handler and Diagnostic Display

**Files:**
- Modify: `public/index.html`

Update the SSE parsing, add diagnostic rendering, and update the share feature.

- [ ] **Step 1: Add diagnostic CSS**

After the `.answer-text em` rule (line 246), add styles for the diagnostic container:

```css
/* Diagnostic (oracle's perception) */
.diagnostic {
  font-family: var(--serif);
  font-size: 1.1rem;
  font-weight: 300;
  font-style: italic;
  line-height: 1.8;
  color: var(--ink-faint);
  margin-bottom: 1.2rem;
  padding-bottom: 1.2rem;
  border-bottom: 1px solid var(--ink-ghost);
}
```

- [ ] **Step 2: Add diagnostic container to HTML**

Inside the `.answer` div, before the `.answer-rule` div (line 424), insert:

```html
<div class="diagnostic" id="diagnostic-text"></div>
```

- [ ] **Step 3: Rewrite the SSE handler in the consult() function**

Replace the SSE reading loop (current lines 547-571) with a type-aware handler:

```javascript
const diagnosticEl = document.getElementById('diagnostic-text');
diagnosticEl.textContent = '';
diagnosticEl.style.display = 'none';

let fullDiagnostic = '';
let fullText = '';
let currentPhase = 'diagnostic'; // or 'reading'

const cursor = document.createElement('span');
cursor.className = 'cursor';

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  buffer += decoder.decode(value, { stream: true });
  const lines = buffer.split('\n');
  buffer = lines.pop() || '';

  for (const line of lines) {
    if (!line.startsWith('data: ')) continue;
    const data = line.slice(6);
    if (data === '[DONE]') break;

    try {
      const evt = JSON.parse(data);

      if (evt.error) {
        showError(evt.error);
        break;
      }

      if (evt.type === 'diagnostic' && evt.text) {
        diagnosticEl.style.display = 'block';
        fullDiagnostic += evt.text;
        diagnosticEl.textContent = fullDiagnostic;
        diagnosticEl.appendChild(cursor);
      }

      if (evt.type === 'separator') {
        cursor.remove();
        currentPhase = 'reading';
        answerText.appendChild(cursor);
      }

      if (evt.type === 'reading' && evt.text) {
        fullText += evt.text;
        answerText.innerHTML = renderMarkdown(fullText);
        answerText.appendChild(cursor);
      }

      // Backward compat: old format (no type field)
      if (!evt.type && evt.text) {
        fullText += evt.text;
        answerText.innerHTML = renderMarkdown(fullText);
        answerText.appendChild(cursor);
      }
    } catch {}
  }
}

cursor.remove();
if (fullText) answerText.innerHTML = renderMarkdown(fullText);
```

- [ ] **Step 4: Update the share button and currentReading**

Update the `currentReading` object to include `diagnostic`:

```javascript
// At declaration (line 455):
let currentReading = { repoName: null, repoUrl: null, text: '', diagnostic: '' };

// After streaming completes (where currentReading.text is set):
currentReading.text = fullText;
currentReading.diagnostic = fullDiagnostic;

// In the share click handler, add diagnostic to the POST body:
body: JSON.stringify({
  repoName: currentReading.repoName,
  repoUrl: currentReading.repoUrl,
  reading: currentReading.text,
  diagnostic: currentReading.diagnostic,
}),

// In the reset function, clear diagnostic:
currentReading = { repoName: null, repoUrl: null, text: '', diagnostic: '' };
diagnosticEl.textContent = '';
diagnosticEl.style.display = 'none';
```

- [ ] **Step 5: Update shared reading render**

In the shared reading handler (line 658), render the diagnostic if present:

```javascript
if (readingDataEl) {
  try {
    const data = JSON.parse(readingDataEl.textContent);
    isSharedReading = true;

    askEl.classList.add('is-gone');
    setRepoTitle(data.repoName, data.repoUrl);

    // Show diagnostic if present
    const diagnosticEl = document.getElementById('diagnostic-text');
    if (data.diagnostic) {
      diagnosticEl.textContent = data.diagnostic;
      diagnosticEl.style.display = 'block';
    }

    answerText.innerHTML = renderMarkdown(data.reading);
    answerEl.classList.add('is-visible');
    btnBack.classList.add('is-visible');

    btnShare.style.display = 'none';
    shareSep.style.display = 'none';
    btnReturn.textContent = 'consult the oracle';
    returnRow.classList.add('is-visible');
  } catch {}
}
```

- [ ] **Step 6: Commit**

```bash
git add public/index.html
git commit -m "Frontend: diagnostic display, typed SSE events, share feature update"
```

---

### Task 5: Update Test Harness

**Files:**
- Modify: `test-readings.js`

The test harness calls the Anthropic API directly (not through the server's SSE endpoint). Update it to use the two-pass flow.

- [ ] **Step 1: Import the new prompts**

Update the import line:

```javascript
import { fetchRepoContext, PERCEPTION_PROMPT, READING_PROMPT } from "./server.js";
```

- [ ] **Step 2: Rewrite runReading for two-pass**

Replace the `runReading` function:

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

  // Pass 2: Reading
  const readingResponse = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2048,
    system: READING_PROMPT,
    messages: [{ role: "user", content: diagnostic }],
  });
  const reading = readingResponse.content[0].text;

  return { diagnostic, reading };
}
```

- [ ] **Step 3: Update the main loop to handle the new return shape**

The `runReading` function now returns `{ diagnostic, reading }` instead of a plain string. Update the main loop:

```javascript
// In the main loop, where `const text = await runReading(...)`:
const result = await runReading(owner, repo);
if (!result) {
  console.log(" SKIP (no context)");
  continue;
}

const { diagnostic, reading: text } = result;
const axioms = extractAxioms(text);
const wordCount = text.split(/\s+/).filter(Boolean).length;

results.push({ owner, repo, category, lang, text, diagnostic, axioms, wordCount });
```

- [ ] **Step 4: Add diagnostic coverage metric to the analyze function**

The spec requires measuring whether diagnostics cover all 7 lenses or cluster. Add this to the `analyze()` function:

```javascript
// Inside analyze(), after the existing analysis sections:

// 8. Diagnostic lens coverage
const LENS_KEYWORDS = {
  trajectory: /\b(ascending|declining|plateauing|sprinting|maintaining|drifting|momentum|trajectory)\b/i,
  conviction: /\b(passion|habit|intent|conviction|purpose|alive|dead)\b/i,
  avoidance: /\b(afraid|fear|avoid|shadow|refuse|won't|clings?|hiding)\b/i,
  gap: /\b(promise|honest|gap|distance|self-image|readme|claims?)\b/i,
  fragility: /\b(fragil|break|kill|depend|maintainer|brittle|collapse)\b/i,
  aesthetic: /\b(value|readability|minimalism|style|philosophy|beauty|clarity|voice)\b/i,
  relationship: /\b(welcome|gatekeep|invitation|contract|beginner|user|community)\b/i,
};

const diagnosticLensCounts = {};
for (const lens of Object.keys(LENS_KEYWORDS)) diagnosticLensCounts[lens] = 0;

for (const r of readings) {
  if (!r.diagnostic) continue;
  for (const [lens, re] of Object.entries(LENS_KEYWORDS)) {
    if (re.test(r.diagnostic)) diagnosticLensCounts[lens]++;
  }
}
```

Also add `diagnosticLensCounts` to the return object and add a "Diagnostic Lens Coverage" section to `generateReport()`:

```javascript
// In generateReport(), add after Category Clustering:
md += `## Diagnostic Lens Coverage\n\n`;
md += `How often does each diagnostic lens appear across ${totalReadings} readings?\n\n`;
md += `| Lens | Readings | % |\n|------|----------|---|\n`;
for (const [lens, count] of Object.entries(analysis.diagnosticLensCounts)) {
  const pct = ((count / totalReadings) * 100).toFixed(0);
  md += `| ${lens} | ${count} | ${pct}% |\n`;
}
```

- [ ] **Step 5: Commit**

```bash
git add test-readings.js
git commit -m "Test harness: two-pass flow with diagnostic capture and lens coverage metric"
```

---

### Task 6: Run Test Harness and Compare Metrics

**Files:**
- Clear: `test-results/readings.json`, `test-results/analysis.md`

- [ ] **Step 1: Clear old results**

```bash
rm -f test-results/readings.json test-results/analysis.md
```

- [ ] **Step 2: Run the 50-repo test harness**

```bash
export $(cat .env | xargs) && GITHUB_TOKEN="$(gh auth token)" node test-readings.js
```

Expected: ~47-50 readings complete. Each reading now involves two API calls, so this will take roughly twice as long as before.

- [ ] **Step 3: Compare metrics against the Round 2 baseline**

Check `test-results/analysis.md` against the targets:

| Metric | Round 2 Baseline | Target |
|--------|-----------------|--------|
| Axiom coverage | 26.7% (28/105) | 40%+ |
| Top axiom frequency | 7.7 @ 16% | < 15% |
| Repeated 5-grams (4+ readings) | 30 | < 20 |
| Opening pattern uniformity | 86% same opener | < 50% |

Key question: Did the axiom abstraction meaningfully expand the axiom pool beyond 28?

- [ ] **Step 4: Commit results**

```bash
git add test-results/
git commit -m "Test results: post-abstraction diversity analysis (round 3)"
```
