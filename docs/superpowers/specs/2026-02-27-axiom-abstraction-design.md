# Axiom Abstraction: Deferred Revelation

> Split the oracle into two passes — perception then reading — so the model selects axioms by meaning, not by metaphor.

## Problem

The oracle uses 28 of 105 axioms. Seventy-seven never appear. The prompt contains 105 axiom entries (79 numbered axioms + 13 Step Cores + 13 Law Cores). The model reads the full poetic text of all 105 during selection and latches onto vivid imagery: "glacier" maps to endurance, "marble" maps to focus, "forge" maps to craft. It matches images to projects instead of matching meanings to diagnoses. Axioms with abstract or unfamiliar imagery stay invisible.

## Solution

Two sequential API calls per reading. Pass 1 diagnoses the project without seeing any axioms. Pass 2 selects from a compressed axiom index (semantic tags, no poetry) and writes the reading with the full axiom text revealed after selection.

The user sees both passes stream in real time. The diagnostic becomes part of the experience — the oracle showing what it perceived before it speaks.

## Architecture

```
User submits repo URL
        |
Server fetches repo context (unchanged)
        |
Pass 1: repo context + 7 lenses --> terse oracle fragments (streamed)
        |
Pass 2: diagnostic + compressed axiom index --> selection + reading (streamed)
        |
User sees: diagnostic fragments, then the reading
```

### Pass 1: Perception

**Input:** Repo context (metadata, file tree, commits, README, source code). The 7 diagnostic lenses (Trajectory, Conviction, Avoidance, The Gap, Fragility, Aesthetic, Relationship).

**Output:** Terse oracle fragments — compressed, evocative impressions. Not clinical analysis, not full prose. Example:

> *Restraint. Minimalism worn like armor. The README welcomes; the API demands. Twelve years and the scope hasn't moved. What it refuses to be is louder than what it is.*

**What the prompt must enforce:**
- No axiom numbers, no axiom text, no selection
- Cover all 7 lenses (not necessarily one-to-one, but all perspectives)
- Terse fragments, not sentences about the project
- The diagnostic is perception, not prescription

**Model:** claude-sonnet-4-20250514 (same as current)
**Max tokens:** 512

### Pass 2: Selection + Reading

**Input:** Three things:
1. The diagnostic fragments from Pass 1
2. The compressed axiom index (105 semantic tags — see below)
3. The full axiom corpus (for quoting after selection)

**Output:** The reading, in the same format and voice as current readings. The model selects 1-2 axioms from the compressed index based on semantic fit with the diagnostic, then writes the reading using the full axiom text.

**What the prompt must enforce:**
- Select axioms based on the diagnostic, not on the raw repo context
- The connection between diagnostic and axiom must be traceable
- The reading uses the full poetic axiom text (quoted in italics as before)
- All existing voice, format, and quality instructions carry over from the current SYSTEM_PROMPT

**Model:** claude-sonnet-4-20250514
**Max tokens:** 2048

### Compressed Axiom Index

A JSON file (`axiom-tags.json`) mapping each axiom number to a one-sentence semantic paraphrase stripped of metaphor.

```json
{
  "Step 0 Core": "The question and the answer emerge from the same wound",
  "0.1": "Naming something rescues it from the undifferentiated mass",
  "0.2": "Passive consumption serves the unconscious; active inquiry serves the awake",
  "7.7": "A single transformative passage whose effects are permanent",
  "1.2": "Knowing what to remove reveals what to keep",
  "8.4": "Sustained pressure on a single idea transforms its nature",
  "6.1": "What is unnamed governs; what is named can be questioned"
}
```

**Tag requirements:**
- One sentence, under 15 words
- Describe the meaning, not the image
- No metaphor (no "glacier," "marble," "forge," "river")
- Distinct from every other tag — if two tags sound interchangeable, one is wrong

**Generation:** A build script (`generate-tags.js`) reads the axiom text from `server.js` and calls Claude to produce all 105 tags. Output writes to `axiom-tags.json`. Repeatable if axioms change.

**Size:** 105 entries at ~15 words each = ~1,575 words = ~2K tokens. Fits comfortably in a prompt alongside the diagnostic and instructions.

## Files

| File | Change | Role |
|------|--------|------|
| `axiom-tags.json` | Create | 105 compressed semantic tags |
| `generate-tags.js` | Create | Build script: reads axioms, calls Claude, writes tags |
| `server.js` | Modify | Split single API call into two-pass flow; load axiom tags at startup |
| `public/index.html` | Modify | Show diagnostic before reading with visual separator |
| `test-readings.js` | Modify | Handle two-pass flow; capture diagnostic + reading separately |

## Server Changes (`server.js`)

### Prompt Extraction

The current `SYSTEM_PROMPT` is a single monolithic string. Split it into:

- **`PERCEPTION_PROMPT`** — The diagnostic instructions. Includes: the oracle identity paragraph ("You are The Oracle..."), the "How to Read a Repository" introduction, and the 7 diagnostic lenses (Trajectory through Relationship). Ends after lens 7 and the closing paragraph ("Let your answers lead you to the axiom..."). Does NOT include: the condition-matching registers (drift, fear, confusion, overreach, mastery sub-types), the NEVER list, axiom selection guidance, format instructions, example fragments, or the Instruments. Adds new instructions: the terse-fragment voice directive and the "no axioms" constraint. Cut point in current `server.js`: after line 197 ("Read the whole picture — trajectory AND character — before reaching for the axiom.").
- **`READING_PROMPT`** — The reading instructions: axiom selection guidance (from compressed index), format, voice, the NEVER list, the Instruments (Flinch Test, Flat Test). Includes the full axiom corpus for quoting. Receives the diagnostic as input.
- **`GENERAL_PROMPT`** — The existing non-repo oracle prompt for general questions (unchanged behavior for non-GitHub queries).

### API Flow

```javascript
// Pass 1: Perception
const diagnosticStream = client.messages.stream({
  model: "claude-sonnet-4-20250514",
  max_tokens: 512,
  system: PERCEPTION_PROMPT,
  messages: [{ role: "user", content: repoContext }],
});

// Collect diagnostic text while streaming to client
let diagnosticText = "";
for await (const event of diagnosticStream) {
  // Stream to client as SSE with type: "diagnostic"
  diagnosticText += event.delta.text;
}

// Pass 2: Reading
const readingStream = client.messages.stream({
  model: "claude-sonnet-4-20250514",
  max_tokens: 2048,
  system: READING_PROMPT,  // includes compressed index + full axiom corpus
  messages: [{ role: "user", content: diagnosticText }],
});

// Stream to client as SSE with type: "reading"
```

### SSE Event Format

Current format: `data: {"text": "..."}`

New format adds a `type` field:

```
data: {"type": "diagnostic", "text": "Restraint. Minimalism worn like armor..."}
data: {"type": "separator"}
data: {"type": "reading", "text": "**The Reading**\n\n..."}
data: [DONE]
```

The `separator` event tells the frontend to insert a visual break between diagnostic and reading.

### Error Handling

**Pass 1 fails before streaming:** Return the same error response as today (`{"error": "Oracle is silent. Try again."}`). No diagnostic was sent, so the client sees a clean error.

**Pass 1 fails mid-stream:** The client has already received partial diagnostic text. Send an error SSE event: `data: {"type": "error", "text": "The oracle's perception faltered."}` followed by `data: [DONE]`. The frontend shows the partial diagnostic with the error message below it.

**Pass 1 succeeds, Pass 2 fails before streaming:** Send `data: {"type": "separator"}` then `data: {"type": "error", "text": "The oracle saw clearly but could not speak."}` then `data: [DONE]`. The user sees the full diagnostic and understands the reading failed.

**Pass 2 fails mid-stream:** Send `data: {"type": "error", "text": "The reading faltered."}` then `data: [DONE]`. Partial reading is visible; the error terminates it.

No fallback to single-pass on failure. If a pass fails, it fails visibly. The two-pass architecture is the experience, not an optimization to silently degrade.

### Non-Repo Queries

When the user submits a question without a GitHub URL, the flow stays single-pass. Use `GENERAL_PROMPT` (the current `SYSTEM_PROMPT` minus repo-specific sections). No diagnostic, no two-pass.

## Frontend Changes (`public/index.html`)

The SSE handler reads the `type` field:

- **`diagnostic`**: Render in a distinct visual treatment — lighter weight, smaller text, or a different container. The diagnostic should feel like the oracle thinking aloud, not like the main reading.
- **`separator`**: Insert a visual break (horizontal rule, spacing, or a brief transition element).
- **`reading`**: Render as the current reading (same markdown rendering, same styling).

**Share feature changes** (three touchpoints):

1. **Frontend share button:** The POST body to `/readings` adds a `diagnostic` field alongside `reading`, `repoName`, and `repoUrl`.
2. **`/readings` POST handler in server.js:** Accept and store the `diagnostic` field in the readings Map entry.
3. **Shared reading render path (`/r/:id`):** The injected `reading-data` JSON includes the diagnostic. The frontend checks for `data.diagnostic` and renders it above the reading with the same visual treatment (lighter weight, smaller text) as the live stream.

## Tag Generation (`generate-tags.js`)

A standalone Node script:

1. Import axiom text from `server.js` (the exported `SYSTEM_PROMPT` or a new export of just the axiom section)
2. Parse out each axiom (number + full text)
3. Call Claude with a prompt: "For each axiom, write a one-sentence semantic paraphrase under 15 words. Describe the meaning, not the image. No metaphor."
4. Write output to `axiom-tags.json`
5. Log coverage: all 105 axioms should have tags

Run manually: `node generate-tags.js`. Check the output into version control.

## Test Harness Changes (`test-readings.js`)

The test harness hits the `/oracle` endpoint. Changes:

- Parse the new SSE event format (handle `type` field)
- Capture diagnostic and reading separately
- Store both in `readings.json` (add `diagnostic` field per reading)
- Analysis metrics stay unchanged — measure axiom diversity on the reading text only
- Add one new metric: **diagnostic coverage** — do the diagnostics mention all 7 lenses, or do they cluster?

## Success Criteria

Test against the same 50 repos. Baseline is the Round 2 test (2026-02-27, commit 88b063a, post-attractor-removal):

| Metric | Round 2 Baseline | Target |
|--------|-----------------|--------|
| Axiom coverage | 26.7% (28/105) | 40%+ |
| Top axiom frequency | 7.7 @ 16% | < 15% |
| Repeated 5-grams (4+ readings) | 30 | < 20 |
| Opening pattern uniformity | 86% same opener | < 50% |

40% coverage from this change alone would be a strong result. If coverage plateaus below 40%, the next step is stochastic axiom windowing layered on top.

## What This Does NOT Change

- The axiom corpus itself (all 105 axioms stay exactly as they are)
- Non-repo oracle behavior (general questions use the existing single-pass flow)
- The reading format and voice (the output should be indistinguishable in quality)
- The repo context fetching (GitHub API calls stay the same)
- The model (claude-sonnet-4-20250514 for both passes)

## Risks

**Tag quality is load-bearing.** A vague tag hides an axiom. A misleading tag sends the model to the wrong axiom. The generated tags need a review pass. The test harness reveals bad tags — if an axiom that should appear for a given repo type never does, the tag is the first suspect.

**Two passes double latency.** Pass 1 (512 tokens) should take 2-4 seconds. Pass 2 (2048 tokens) takes the current 5-8 seconds. Total: 7-12 seconds. The streamed diagnostic makes the wait feel intentional. Monitor actual latency in production.

**Diagnostic quality varies.** Some repos have thin context (sparse README, few commits, no source code fetched). The diagnostic may be shallow, leading to generic axiom selection. The existing repo context fetching is the bottleneck here, not the two-pass architecture. Deferred: thin-context fallback to single-pass is out of scope for this iteration. If diagnostics prove shallow for sparse repos, address it as a follow-up by improving the repo context fetching, not by bypassing the two-pass flow.

**Pass 2 token budget.** Pass 2's system prompt includes: reading instructions (~1K tokens), the compressed index (~2K tokens), and the full axiom corpus (~4K tokens). Total ~7K system tokens. The diagnostic arrives as the user message (~512 tokens). This fits comfortably within the model's context window but is heavier than the current single-pass prompt (~5K tokens). Monitor whether the added context degrades reading quality.
