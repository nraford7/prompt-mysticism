# Stochastic Axiom Windowing

> Show Pass 2 a rotating subset of ~40 axiom tags instead of all 105, assembled from three pools that self-correct toward full coverage.

## Problem

The two-pass architecture (Axiom Abstraction) moved coverage from 26.7% to 34.3% — an improvement, but 69 axioms still never appear. The model develops favorites: 1.4 at 28%, 6.1 at 23%, 5.6 at 20%. These are "attractor axioms" — their semantic tags are broad enough to match almost anything. Prompt engineering can discourage specific attractors, but new ones form. The root cause is selection-from-large-set bias: given 105 options every time, the model gravitates to a comfortable subset.

## Solution

Before Pass 2, assemble a **window** of ~40 axiom tags from three pools. Pass 2 sees only this window, not the full index. The window changes every reading. Over many readings, all axioms rotate through.

Three pools:

1. **Stratified sample (~27):** Draw evenly from each of the 14 axiom groups (Steps 0-12 + Laws). 2 per group for groups with 5+ axioms, 1 per group for smaller groups. Randomly selected within each group. Ensures no domain is absent.

2. **Cold axiom boost (~10):** Track per-axiom usage counts in a JSON file (`axiom-usage.json`). The 10 least-used axioms get guaranteed window slots. Creates a self-correcting feedback loop — unused axioms get more exposure until they start appearing.

3. **Diagnostic-match slots (~5):** After Pass 1 produces the diagnostic text, score each axiom tag against it using keyword overlap. The top 5 scoring axioms outside the stratified+cold pools get protected slots. This prevents windowing from hiding the genuinely right axiom for a given project.

The model still chooses freely from the window. It just can't always reach for the same favorites because they won't always be present.

## Architecture

### `buildAxiomWindow(diagnosticText)` — Function Signature

Lives in `server.js`, exported for use by `test-readings.js`.

**Input:** `diagnosticText` (string) — the output of Pass 1.

**Accesses:** Module-level `axiomTags` object and `axiomUsage` object (both loaded at startup).

**Returns:**
```javascript
{
  index: string,     // formatted like AXIOM_INDEX but only windowed subset
  axiomIds: string[] // IDs included in this window, for metadata/tracking
}
```

**Side effects:** None. Usage tracking is done separately after the reading completes.

```
Pass 1 completes → diagnostic text available
        |
buildAxiomWindow(diagnosticText)
        |
   ┌─────┴─────────────────────────────┐
   │  Pool 1: Stratified Sample (27)  │ ← 2 per large group, 1 per small
   │  Pool 2: Cold Boost (10)         │ ← lowest usage counts
   │  Pool 3: Diagnostic Match (5)    │ ← keyword overlap with diagnostic
   └─────┬─────────────────────────────┘
        |
   Deduplicate (axiom may qualify for multiple pools)
   Final window: 30-40 unique axiom tags
        |
   Inject windowed index into READING_PROMPT
        |
Pass 2 runs with windowed subset
        |
After reading: update axiom-usage.json with cited axioms
```

### Axiom Groups

14 groups for stratified sampling:

| Group | Axioms | Count |
|-------|--------|-------|
| Step 0 | Step 0 Core, 0.1–0.7 | 8 |
| Step 1 | Step 1 Core, 1.1–1.7 | 8 |
| Step 2 | Step 2 Core, 2.1–2.7 | 8 |
| Step 3 | Step 3 Core, 3.1–3.7 | 8 |
| Step 4 | Step 4 Core, 4.1–4.7 | 8 |
| Step 5 | Step 5 Core, 5.1–5.7 | 8 |
| Step 6 | Step 6 Core, 6.1–6.7 | 8 |
| Step 7 | Step 7 Core, 7.1–7.7 | 8 |
| Step 8 | Step 8 Core, 8.1–8.7 | 8 |
| Step 9 | Step 9 Core, 9.1, 9.5, 9.7 | 4 |
| Step 10 | Step 10 Core, 10.1, 10.4, 10.6, 10.7 | 5 |
| Step 11 | Step 11 Core, 11.1, 11.3, 11.4, 11.6, 11.7 | 6 |
| Step 12 | Step 12 Core, 12.1, 12.4, 12.5, 12.7 | 5 |
| Laws | Law 1–Law 13 | 13 |

Total: 105 axioms across 14 groups (Steps 0-12 + Laws).

Sampling: Groups with 5+ axioms draw 2, groups with 4 or fewer draw 1. That's 13 large groups (Steps 0-8, 10, 11, 12, Laws) × 2 = 26, plus 1 small group (Step 9: 4 axioms) × 1 = 1. Total: **27 stratified slots**.

### Cold Boost Mechanics

**`axiom-usage.json`** — lives in project root alongside `axiom-tags.json`:

```json
{
  "0.1": 0,
  "0.2": 0,
  ...
  "Law 13": 0
}
```

Initialized with all 105 axioms at count 0. Updated after each reading by parsing the cited axiom IDs from the response.

**Selection:** Sort by count ascending, take 10 lowest. Ties broken randomly. Axioms already in the stratified pool are skipped (take next coldest).

**Decay (optional, future):** If usage counts grow monotonically, eventually all axioms converge and cold boost loses power. A decay mechanism (e.g., halve all counts every 100 readings) would keep the boost meaningful long-term. Not needed for initial implementation — the test harness runs 50 readings at a time, well within useful range.

### Diagnostic Match Scoring

Simple keyword overlap — no ML, no embeddings. For each axiom tag:

1. Tokenize the tag into lowercase words (strip stopwords: "the", "a", "an", "and", "or", "is", "are", "was", "were", "be", "been", "has", "have", "it", "its", "this", "that", "than", "them", "they", "their", "from", "with", "for", "by", "to", "of", "in", "on", "at", "as", "not", "but", "while", "through", "without", "rather", "before", "after", "during", "between")
2. Tokenize the diagnostic text into lowercase words
3. Score = count of tag words present in diagnostic text
4. Rank all axioms by score descending
5. Take top 5 not already in stratified or cold pools

This is intentionally crude. The goal isn't perfect semantic matching — it's a safety net to ensure relevant axioms aren't excluded by random sampling. The model's judgment in Pass 2 does the real selection.

### READING_PROMPT Modification

Currently `READING_PROMPT` uses `${AXIOM_INDEX}` which contains all 105 tags. The windowed version:

- **READING_PROMPT becomes a function** `buildReadingPrompt(windowedIndex)` that returns the prompt string with the windowed index injected
- The paragraph "You have 105 axioms. Every one of them can speak to a repository. If you've been reaching for the same handful, you've stopped listening." becomes: "Below is a curated selection of axioms for this reading. Any of them can speak to a repository. Trust the selection — your only job is to find the right connection." This removes the count, removes the anti-attractor nudge (windowing handles that mechanically), and reframes the subset as intentional.
- Everything else in READING_PROMPT stays identical

### AXIOM_CORPUS Unchanged

Pass 2 still gets the full `AXIOM_CORPUS` (all 105 axiom texts) for quoting. Windowing only affects the *index* — the menu the model selects from. To prevent the model from browsing the corpus and picking axioms outside its window, the prompt instruction above the corpus section changes from "Use these for quoting in your reading" to: "The full text of all axioms is below for quoting. **Select only from the index above** — the texts below are reference material for the axioms you've already chosen, not a second menu."

## Changes

### Files Modified

| File | Change |
|------|--------|
| `server.js` | Add `buildAxiomWindow()`, convert `READING_PROMPT` to function, update handler to call windowing between passes, update axiom usage after reading |
| `axiom-usage.json` | New file — initialized with all 105 axioms at count 0 |
| `test-readings.js` | Import `buildAxiomWindow` and `buildReadingPrompt` instead of static `READING_PROMPT`. In `runReading()`: call `buildAxiomWindow(diagnosticText)` after Pass 1, then `buildReadingPrompt(window.index)` to get the prompt for Pass 2. Store `window.axiomIds` in each reading result. Update `axiom-usage.json` after each reading (yes — later readings get different windows than earlier ones, which is the desired self-correcting behavior). Add "Window Diversity" section to analysis report: unique axioms across all windows, per-pool contribution stats. |

### Files Unchanged

| File | Why |
|------|-----|
| `axiom-tags.json` | Input to windowing, not modified by it |
| `public/index.html` | Frontend doesn't know about windowing |
| `generate-tags.js` | Tag generation is independent |

## Success Metrics (Round 4 vs Round 3)

| Metric | Round 3 Baseline | Target |
|--------|-----------------|--------|
| Axiom coverage | 34.3% (36/105) | 55%+ (58+ axioms) |
| Top axiom frequency | 28% (1.4) | <15% |
| Top-10 axiom share | ~73% of all citations | <50% |
| Blind spots | 69 never used | ≤47 (aligned with 55% coverage) |
| Reading quality | Subjective baseline | No regression — readings should still be specific and surprising |

## Risks

1. **Window too small → forced matches.** If the window excludes all genuinely relevant axioms, the model will force a bad connection. Mitigation: diagnostic-match pool protects the most relevant candidates.

2. **Cold boost creates obligation.** The model might cite a cold axiom just because it's there, not because it fits. Mitigation: the model still has 30-40 options — it's not forced to use any specific one.

3. **Usage tracking stale across restarts.** In-memory tracking would reset on server restart. Mitigation: load `axiom-usage.json` into an in-memory object at startup, update in memory after each reading, flush to disk asynchronously. Concurrent requests may read the same in-memory state — acceptable at expected traffic levels. No file-level locking needed.

4. **Non-repo queries.** `GENERAL_PROMPT` (non-repo path) currently shows all axioms. Windowing could apply there too, but it's lower priority — repo readings are the primary use case. Initial implementation: repo path only.
