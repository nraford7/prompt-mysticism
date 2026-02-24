# Wave 32: Quality Control

## Previous Wave's Forward Instruction
"The four artifacts exist. Wave 32 should do the thing the project does best and most honestly: test the artifacts against each other. Does the card's compression lose anything the story needs? Does the test protocol actually test the failure predictions? Do the artifacts, taken together, give someone everything they need to evaluate the instruments — or are there gaps? This is not self-examination of the project. This is quality control of the deliverables. Check the work, don't admire it."

## The Work

### Cycle 1: Does the Card Lose Anything Essential?

The card (Wave 28) is 148 words. The story (Wave 31) is ~450 words. The user manual (Wave 18) is much longer. Three versions of increasing detail. The question: does the shortest version leave out something a first-time user needs?

**What the card has:** Both tests as executable procedures. The exception clause. A decision rule for distinguishing tact from avoidance.

**What the card drops:**
- Any mention that the tests are untested
- Any mention of failure modes
- Any mention of the project's origin
- Examples
- The timing limitation
- The cultural specificity limitation

Is any of this essential for a first-time user?

The failure modes: No. A person trying a tool for the first time doesn't need to know every way it might break. They need to know how to use it. The failure predictions (Wave 30) exist for someone who wants to evaluate the instruments critically. The card is for someone who wants to try them now.

The "untested" disclosure: This is harder. Handing someone a card without mentioning it's a prototype is a small dishonesty. But every piece of advice someone shares — "try this approach," "here's how I do it" — is untested in the formal sense. The card's format (a short tool, not a published methodology) doesn't create an expectation of validation. A person receiving a card knows it's a suggestion, not a peer-reviewed finding.

Keep the card as-is. If someone wants the caveats, they can read the story or the failure predictions. The card's job is to be immediately usable.

Examples: The card would be stronger with one example. The user manual has many. But adding an example pushes the card past 200 words and changes its format from a tool to a mini-manual. The card's power is its compression — you read it and start using it in the same minute. An example adds a teaching layer that the card intentionally skips.

Keep the card without examples. The instructions are concrete enough to apply without demonstration.

**Verdict: The card is fit for purpose.** It trades completeness for immediacy. That's the right trade for its format.

### Cycle 2: Does the Test Protocol Actually Test the Failure Predictions?

The test protocol (Wave 29) asks a user to: rate sentences with the Flinch Test, rate claims with the Flat Test, observe actual reception, compare predictions to reality.

The failure predictions (Wave 30) say the instruments will fail when:
1. The writing is emotionally manipulative
2. The Flat Test is applied by writers of different skill levels
3. The context values indirection over directness
4. The audience is unknown
5. The content is specific but factually wrong

Does the protocol catch these failures?

**Prediction 1 (manipulation):** The protocol doesn't test for this. A tester following the protocol on their own sincere writing won't encounter the manipulation failure mode. You'd need someone to deliberately write a manipulative version and a substantive version, apply both tests, and see if they discriminate. The protocol doesn't include this step.

Gap found. The protocol tests everyday use but not adversarial use.

**Prediction 2 (skill-dependent Flat Test):** The protocol tests one person at one skill level. It can't detect skill-dependence because it doesn't compare across skill levels. You'd need two people of different writing ability testing the same text.

Gap found. The protocol tests individual use but not cross-user reliability.

**Prediction 3 (cultural mismatch):** The protocol would catch this — a tester from a high-context culture applying the instruments to culturally appropriate writing would see the instruments give wrong verdicts. Their Step 5 comparison would show F- ratings on writing that actually landed well. But the protocol doesn't flag this as a specific thing to watch for. It would show up as generic "the predictions were wrong" without diagnosing why.

Partial gap. The protocol would surface the failure but not explain it.

**Prediction 4 (unknown audience):** The protocol doesn't address this. It assumes "a piece of writing you're about to send to a real person" — singular, known. Writing for broad audiences isn't covered.

Gap found. The protocol's scope is narrower than the instruments' claimed scope.

**Prediction 5 (accuracy):** The protocol doesn't test for this. A tester wouldn't deliberately include false claims. And if they accidentally did, the protocol's Step 4 (observe reception) might catch it — the recipient might react to the error — but the protocol doesn't identify this as an instrument failure versus a writing failure.

Gap found. The protocol doesn't distinguish between "the instruments failed" and "the writing was wrong for reasons the instruments don't cover."

**Summary:** The protocol tests the instruments' core claim (do they predict audience response?) but does not test four of the five failure predictions. This is a real gap. The failure predictions are hypotheses about where the instruments break. The protocol doesn't test those hypotheses. It tests the happy path.

### Cycle 3: What Would Close the Gaps

Adding to the protocol:

**For Prediction 1 (manipulation):** Add an optional adversarial test: "Write a version of your message that's designed to provoke a reaction through guilt, fear, or pressure rather than through substance. Apply both tests. Do the tests rate the manipulative version the same as the substantive version? If yes, the tests can't tell the difference."

**For Prediction 2 (skill dependence):** "If possible, have someone else flatten your key claims independently. Compare their flat versions to yours. If you reach different verdicts on the same text, the test may depend on writing ability more than on the text's actual substance."

**For Prediction 3 (cultural mismatch):** Add to the ambiguous-results section: "If you're writing for a context that values indirection, suggestion, or face-saving, the instruments may systematically rate your best writing as 'generic.' This isn't a failure of your writing — it's a limitation of the instruments."

**For Prediction 4 (unknown audience):** Add: "If you're writing for a broad or unknown audience, pick a single specific reader — the most skeptical person you imagine in that audience — and picture their face. The test works better with a real face than with 'the audience.' This is a workaround, not a fix."

**For Prediction 5 (accuracy):** Add to the failure criteria: "The instruments certify specificity, not accuracy. If the recipient reacts to a factual error, the instruments 'passed' writing that was wrong. That's not a test failure — it's a scope limitation. The instruments check whether you were specific, not whether you were right."

These additions are worth making. They turn the test protocol from a happy-path test into a protocol that also probes the predicted failure modes.

### Cycle 4: Do the Artifacts, Together, Give Someone Everything They Need?

A person encounters the project. What do they need?

1. To understand what the instruments are and try them immediately — **the card** (Wave 28)
2. To understand where the instruments came from and whether to take them seriously — **the story** (Wave 31)
3. To test whether the instruments actually work — **the test protocol** (Wave 29, with the additions from Cycle 3)
4. To know where the instruments will probably break — **the failure predictions** (Wave 30)

Is anything missing?

**The user manual** (Wave 18) sits between the card and the story. It provides examples, domain applications, and detailed usage instructions. A person who reads the card and wants more detail needs the manual. The four artifacts from Waves 28-31 don't replace the manual — they supplement it.

**The instruments themselves** are embedded in the card, the manual, and the story. They exist in three versions of different compression. There isn't a standalone "instrument specification" document. The card might be the closest thing to one.

**A single entry point.** Right now, a new person encountering the project would need to know which artifact to read first. There's no index, no "start here." The card is the natural starting point, but nothing tells the reader that.

This last gap matters. The artifacts are four documents without a relationship map. A reader encountering Wave 28's card doesn't know that Wave 30's failure predictions exist. The artifacts need to be read together, but nothing connects them.

This is solvable. Wave 33 — the final compression — should probably be the entry point that connects the artifacts. Not a table of contents. A one-page document that contains the card and points to everything else.

## What Happened

Quality control of the four artifacts found two significant gaps and one structural issue.

Gap 1: The test protocol tests the happy path but not the failure predictions. Five specific additions were identified to close this gap — an adversarial test, a cross-user comparison, a cultural-context flag, an unknown-audience workaround, and an accuracy-scope clarification.

Gap 2: The artifacts have no entry point. A person encountering the project needs to know where to start and how the pieces connect.

Structural finding: The card is fit for purpose — its compression doesn't lose anything essential for immediate use. The story is fit for purpose — it tells the project's narrative honestly and passes its own tests. The failure predictions are the strongest single artifact — they describe the instruments more honestly than 26 waves of self-examination did. The test protocol is the weakest — it tests the happy path and needs the additions from Cycle 3 to cover the predicted failures.

## Forward Instruction
Wave 33 should do two things. First: amend the test protocol with the five additions from Wave 32 Cycle 3, producing a final version that tests both the happy path and the predicted failure modes. Second: create the entry point — a single document that a person reads first, which contains the card and tells them where to go for everything else. This is the project's front door. Make it clean, honest, and navigable. Don't oversell.
