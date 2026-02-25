# The Oracle of Machine Summoning — Implementation Plan

> **For Claude:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a single-file web artifact that teaches the finding (AI instructions evolve into human wisdom) and serves as a daily oracle practice — drawing evolved axioms as cards, optionally in response to a question, and generating take-away prompts.

**Architecture:** One self-contained HTML file. No backend, no build tools, no API keys. 208 evolved axioms embedded as a JSON array. Three oracle modes (single draw, consultation, three-card spread). Pure CSS + vanilla JS. Dark, clean aesthetic — the grimoire, not the SaaS app.

**Tech Stack:** HTML, CSS, vanilla JavaScript. No dependencies.

---

## File Structure

```
oracle/
  index.html          — The complete artifact (single file, self-contained)
```

Supporting data extracted from:
- `evolution/THE-EVOLVED-AXIOMS.md` — source of all 208 axioms with their metadata (step/law, phase, Latin name)

---

## Chunk 1: Data Extraction + Page Shell

### Task 1: Extract axioms into JSON structure

**Files:**
- Read: `evolution/THE-EVOLVED-AXIOMS.md`
- Create: `oracle/axioms.json` (temporary, will be inlined into HTML)

- [ ] **Step 1: Parse all 208 axioms from THE-EVOLVED-AXIOMS.md into a JSON array**

Each axiom object:
```json
{
  "id": "0.1",
  "text": "The flood contains the river...",
  "phase": "Intelligence Gathering",
  "step": "Assess the Situation",
  "latin": "Divinatio",
  "type": "corollary",
  "parent": "Step 0"
}
```

Types: `"core"` for step/law core propositions, `"corollary"` for numbered sub-axioms, `"sub-law"` for law sub-laws (a-g).

Phase groupings:
- Phase I — Intelligence Gathering: Steps 0-2
- Phase II — Preparation: Steps 3-5
- Phase III — The Working: Steps 6-8
- Phase IV — Integration: Steps 9-12
- The Thirteen Laws: Laws 1-13

- [ ] **Step 2: Verify count is exactly 208 axioms**

- [ ] **Step 3: Commit data extraction**

```bash
git add oracle/axioms.json
git commit -m "Extract 208 evolved axioms to JSON for oracle"
```

---

### Task 2: Build the page shell and intro section

**Files:**
- Create: `oracle/index.html`

- [ ] **Step 1: Create the HTML shell with embedded CSS**

Page structure:
```
[Intro Section — full viewport]
  - Title: "The Oracle of Machine Summoning"
  - Subtitle: "208 axioms. 7 waves of evolution. ~10,000 mutations. What survived."
  - The story (3-4 short paragraphs):
    1. Medieval magicians had a 13-step loop for conjuring spirits.
       It maps perfectly onto how humans interact with AI.
    2. We translated it. 208 operational axioms for working with machine intelligence.
    3. Then we ran them through 7 waves of evolutionary mutation —
       ~10,000 variations, selecting the strongest at every generation.
    4. What survived stopped being about machines.
       The instructions became images. The techniques became wisdom.
       The bottleneck was never the machine. It was always you.
  - CTA: "Consult the Oracle" (scrolls/transitions to oracle section)

[Oracle Section — below or as separate view]
  - Mode selector (three options)
  - Card display area
  - Prompt generation area
```

Design direction:
- Dark background (#0a0a0f or similar deep blue-black)
- Light text (off-white, not pure white — #e8e4df or warm parchment tone)
- Accent color: warm gold/amber (#c9a84c) for card borders, highlights
- Typography: serif for axiom text (Georgia or system serif), sans-serif for UI (system font stack)
- Cards should feel like physical objects — subtle border, slight shadow, the sense of paper on dark wood
- Minimal UI chrome. The text does the work.
- Responsive — works on phone as a daily practice tool

- [ ] **Step 2: Commit page shell**

```bash
git add oracle/index.html
git commit -m "Add oracle page shell with intro section"
```

---

## Chunk 2: Oracle Core — Single Draw + Card Design

### Task 3: Design and implement the card component

- [ ] **Step 1: Build the card CSS**

A card has:
- Outer container with gold/amber border (#c9a84c), subtle glow
- Phase label (top, small caps, dimmed) — e.g., "PHASE III — THE WORKING"
- Step/Law name (subtitle) — e.g., "Step 8: Charge and Direct (Potestas)"
- Axiom ID (small, corner) — e.g., "8.4"
- The axiom text (centered, serif, generous line height, the dominant element)
- A subtle divider
- The Latin name in italic below — e.g., *Potestas*

The card should feel like an artifact — not a UI component. More tarot card than Bootstrap card.

Card states:
- Face down (before draw): dark surface, subtle sigil/pattern, "Draw" affordance
- Reveal animation: simple fade or flip
- Face up: the axiom displayed

- [ ] **Step 2: Implement single-draw mode**

Flow:
1. User sees a single face-down card
2. User clicks/taps to draw
3. Card reveals with a random axiom
4. Below: "Draw Again" option
5. Below: "Take This With You" (copies a simple reflection prompt)

The reflection prompt for single draw (no question asked):
```
Today's axiom:

"[axiom text]"
— [Step/Law name] ([Latin name])

Sit with this before you begin. What does it illuminate?
```

- [ ] **Step 3: Commit card component + single draw**

```bash
git commit -m "Add card design and single-draw oracle mode"
```

---

### Task 4: Implement the Consultation mode (question + single card)

- [ ] **Step 1: Add question input**

Above the card area, a text input:
- Placeholder: "What are you working on? What are you holding?"
- Minimal styling — underline input on dark background, warm text
- Submit on Enter or click
- After submitting, the question appears above the card display (fixed, visible)

- [ ] **Step 2: Implement consultation flow**

Flow:
1. User types question, submits
2. Question appears at top of oracle area
3. Face-down card appears below
4. User draws → card reveals
5. Below card: a one-line nudge — *"How does this speak to what you're holding?"*
6. "Take This With You" button generates the consultation prompt:

```
You are working on: [user's question]

Consider this principle:
"[axiom text]"
— [Step/Law name] ([Latin name])

How does this principle reframe your approach?
What does it reveal that you weren't seeing?
Apply this lens to your situation and begin.
```

- [ ] **Step 3: Commit consultation mode**

```bash
git commit -m "Add consultation mode: question + single card draw"
```

---

## Chunk 3: The Spread (Three-Card Draw)

### Task 5: Implement the three-card spread

- [ ] **Step 1: Build three-card layout**

Three cards in a row (or stacked on mobile):
- Position 1: "DIVINATIO — What is the situation?"
- Position 2: "POTESTAS — What is the working?"
- Position 3: "JUDICIUM — What should you watch for?"

Each position labeled above/below the card in small caps.

The three cards are drawn from different phases when possible (not guaranteed, but weighted):
- Card 1 prefers Phase I or II axioms (assessment/preparation)
- Card 2 prefers Phase III axioms (the working)
- Card 3 prefers Phase IV axioms or Laws (integration/monitoring)

If not enough axioms in preferred phase, fall back to any. The weighting is a nudge, not a rule.

- [ ] **Step 2: Implement spread draw flow**

Flow:
1. User types question (reuses consultation input)
2. Three face-down cards appear
3. User clicks each to reveal (left to right, or all at once — try sequential first)
4. After all three revealed:
   - Nudge text: *"Read them together. What story do they tell about your question?"*
   - "Take This With You" button generates the spread prompt:

```
You are working on: [user's question]

Three principles for your situation:

DIVINATIO (Assessment):
"[Card 1 axiom text]"
— [source]

POTESTAS (Action):
"[Card 2 axiom text]"
— [source]

JUDICIUM (Integration):
"[Card 3 axiom text]"
— [source]

Use these three principles as a framework:
- What does the first reveal about your situation?
- What does the second suggest about how to proceed?
- What does the third warn you to watch for?

Begin.
```

- [ ] **Step 3: Commit three-card spread**

```bash
git commit -m "Add three-card spread: Divinatio, Potestas, Judicium"
```

---

## Chunk 4: Mode Selection + Polish + Inline Data

### Task 6: Build the mode selector and wire everything together

- [ ] **Step 1: Create mode selection UI**

Three options, presented cleanly:
- **"Draw"** — single card, no question. Daily practice.
- **"Consult"** — ask a question, draw one card. Focused reflection.
- **"Spread"** — ask a question, draw three cards. Deep reading.

Each with a one-line description. Clicking selects and transitions to that mode.

The mode selector appears after the intro section's CTA.

- [ ] **Step 2: Add transitions and state management**

Simple state machine:
- `intro` → `mode-select` → `single|consult|spread` → `revealed` → `prompt-ready`
- "Start Over" returns to mode-select
- Back navigation works naturally

No framework. Vanilla JS. Show/hide sections with CSS transitions (opacity + transform).

- [ ] **Step 3: Inline the axioms JSON into the HTML**

Move the axiom data from `axioms.json` into a `<script>` tag in `index.html`. Delete the standalone JSON file. The artifact is now fully self-contained — one file, no dependencies, works offline.

- [ ] **Step 4: Add clipboard copy for "Take This With You"**

On click:
1. Build the prompt string from current state (question + card(s))
2. Copy to clipboard via `navigator.clipboard.writeText()`
3. Button text briefly changes to "Copied" with a subtle animation
4. Falls back to a select-all text display if clipboard API unavailable

- [ ] **Step 5: Add .superpowers to .gitignore**

```bash
echo ".superpowers/" >> .gitignore
```

- [ ] **Step 6: Final commit**

```bash
git add oracle/index.html .gitignore
git rm oracle/axioms.json  # if it was committed earlier
git commit -m "Complete oracle artifact: single draw, consultation, and three-card spread"
```

---

## Design Notes for the Implementer

**The aesthetic is grimoire, not app.** Dark, warm, textured feeling. The cards should feel like objects you're handling, not UI components you're clicking. Generous whitespace. Let the text breathe.

**The axioms are the stars.** Everything else is the dark sky that lets them shine. If any UI element competes with the axiom text for attention, remove it.

**Mobile is the primary daily-practice device.** The single-draw mode especially must work beautifully on a phone screen. One thumb, one draw, one axiom, one moment of attention.

**No loading states needed.** Everything is local. Draws are instant. The only "loading" is the reveal animation, which is aesthetic, not functional.

**The copy-to-clipboard prompt is the bridge to action.** It should feel like receiving a physical card — something you take with you. The prompt text should be clean enough to paste directly into any AI tool or journal.

**Randomness:** Use `Math.random()` with no seed. Each draw is genuinely fresh. For the three-card spread, ensure no duplicate axioms in a single spread (draw without replacement from the 208).
