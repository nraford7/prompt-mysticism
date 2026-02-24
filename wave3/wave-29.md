# Wave 29: The Test Protocol

## Previous Wave's Forward Instruction
"Wave 29 should produce the second artifact: the test protocol. Not 'here are the blind spots' (that's Wave 25) but 'here is exactly how you test these instruments.' A step-by-step procedure that someone could follow to determine whether the Flinch Test and Flat Test actually work as claimed. It needs specific success criteria, specific failure criteria, and a minimum viable test — the smallest possible test that would produce meaningful evidence. Design it for a single person with one hour, not a research team with a grant."

## The Work

### Cycle 1: What Would Count as Evidence

Before writing the protocol, define what a test would need to show.

**The Flinch Test claims:** When you picture the specific recipient's face and check whether the sentence changes their expression, this exercise reliably distinguishes between generic and specific communication. Sentences that pass the test produce measurable responses in real recipients. Sentences that fail produce polite non-engagement.

**What would validate this claim:** A real person uses the Flinch Test on their own writing. They predict "this will change the reader's face" or "this won't." Then they deliver the writing. Then they observe whether the reader's response matches the prediction.

**What would invalidate this claim:** The predictions don't correlate with actual reader responses. Sentences the tester rated as "face-changing" get polite nods. Sentences rated as "generic" get strong reactions. The test's signal doesn't match real-world reception.

**The Flat Test claims:** When you restate a point in the dullest possible language and the flat version is boring or could apply to anyone, the original was rhetoric over substance. When the flat version is still specific and interesting, the original was real.

**What would validate this claim:** A real person uses the Flat Test on their own writing. Points that survive flattening are independently judged (by the recipient or a third party) as substantive. Points that collapse under flattening are independently judged as empty.

**What would invalidate this claim:** Points that survive flattening are judged as empty or irrelevant by recipients. Points that collapse are judged as genuinely useful. The Flat Test's verdict doesn't predict the recipient's assessment of substance.

### Cycle 2: The Minimum Viable Test

One person needs to be able to do this in one hour with no special equipment.

---

**HOW TO TEST THE INSTRUMENTS**

**What you need:** A piece of writing you're about to send to a real person. Not a hypothetical — something you'd send today regardless of this test. An email, a Slack message, feedback, a recommendation, a proposal. Something with stakes, even small ones.

**Time required:** One hour total. 15 minutes to apply the instruments. The rest is observation over the following days.

**STEP 1: APPLY THE FLINCH TEST (5 minutes)**

Read your piece. For each key sentence or claim, picture the specific recipient's face. Rate each one:
- **F+** = I can picture their expression changing (eyebrows, jaw, eyes)
- **F-** = I picture a polite nod or no reaction
- **F?** = I genuinely can't tell

Write down your ratings. Don't revise yet.

**STEP 2: APPLY THE FLAT TEST (10 minutes)**

Take each key claim and restate it in the dullest possible language. No metaphors, no modifiers. For each:
- **S+** = The flat version is still specific to this situation and still interesting
- **S-** = The flat version is boring or could apply to anyone
- **S?** = I genuinely can't tell

Write down your ratings and your flat restatements.

**STEP 3: REVISE (optional)**

If you want, revise the F- and S- sentences before sending. Or send as-is. Either way works for the test — Step 3 is about improvement, not evidence-gathering.

**STEP 4: OBSERVE (over the following days)**

After the recipient reads your writing, notice:
- Which sentences or points did they respond to? (Quoted back, asked about, acted on, pushed back on)
- Which sentences got no response? (Skipped, met with "sounds good," or produced no visible reaction)
- Did anything you rated F+ get ignored?
- Did anything you rated F- get a strong reaction?

**STEP 5: COMPARE (15 minutes, after Step 4)**

Look at your Step 1 and Step 2 ratings next to your Step 4 observations.

**The instruments work if:**
- F+ sentences got noticeably more engagement than F- sentences
- S+ claims were responded to as substantive; S- claims were ignored or met with polite agreement
- Your predictions roughly matched what happened
- The exercise of picturing the face and flattening the claims changed at least one sentence for the better

**The instruments fail if:**
- F+ and F- sentences got similar levels of response (the test doesn't discriminate)
- S- claims were received as substantive despite collapsing under flattening (the Flat Test miscategorizes)
- Your predictions were wrong more often than right
- The exercise didn't change anything — you would have written the same thing without it

**Ambiguous results:**
- Small sample (one email, two claims) — run it again on a different piece
- Recipient is unusually agreeable or unusually combative — the test might work differently on different audiences
- You couldn't flatten competently (your flat versions were still rhetorical) — this is a known blind spot, not a test failure

---

### Cycle 3: Testing the Protocol Against Itself

Apply the Flinch Test to the protocol: picture someone reading this. A product manager who writes 30 emails a day and wonders why half of them get ignored. They read the protocol.

Does their expression change?

"For each key sentence, picture the specific recipient's face." — This is immediately actionable. The product manager either starts doing it or doesn't. The protocol doesn't explain why this works. It just says do it. That's deliberate.

"Did anything you rated F+ get ignored?" — This is the moment of truth in the protocol. The tester finds out whether their prediction was right. If it wasn't, the instruments failed in a specific, documented way. The protocol makes failure visible instead of hiding it.

The protocol passes the Flinch Test. It gives concrete tasks with observable outcomes. A reader can't politely nod at it — they either run the test or they don't.

Apply the Flat Test to the protocol: "Rate your sentences as face-changing or not, then see if you were right."

Does the flat version survive? Yes. The protocol is already fairly flat — it's a procedure, not an argument. The flat version is less detailed but not less true. The protocol survives because it's built from actions, not claims.

### Cycle 4: What the Protocol Can't Test

The protocol has a structural limitation: it tests whether the instruments predict audience response. It doesn't test whether the instruments *improve* the writing. A person could rate their sentences, observe the responses, find the predictions accurate, and still have written the same thing without the instruments. Correlation between predictions and outcomes doesn't prove the instruments caused better writing.

The improvement question needs a different test — applying the instruments to one piece and not to another, then comparing reception. That's a controlled experiment. It's beyond the scope of "one person, one hour." It's worth noting but not worth trying to squeeze into this protocol.

The protocol tests the minimum claim: do the instruments accurately predict which parts of your writing will land? That's enough. If the instruments predict well, they're useful as diagnostic tools even if they don't cause improvement — knowing which of your sentences are wallpaper is valuable even if you lack the skill to fix them.

## What Happened

The test protocol was written. It's designed for one person with one hour and one real piece of writing. Five steps: rate with the Flinch Test, rate with the Flat Test, optionally revise, observe actual reception, compare predictions to reality. Explicit success criteria, failure criteria, and ambiguous-result criteria.

The protocol tests the minimum viable claim — do the instruments predict audience response? — rather than the stronger claim — do the instruments improve writing? The prediction claim is testable in one iteration. The improvement claim needs controlled comparison, which is beyond minimum-viable scope.

The protocol passes both of its own tests. It's procedural (survives flattening) and specific (demands concrete action from the reader). Its main limitation is sample size — one email to one person is weak evidence. But weak evidence is infinitely more than no evidence, which is what the project currently has.

## Forward Instruction
Wave 30 should produce the third artifact: falsifiable predictions about where the instruments will fail. Not vague limitations ("the instruments have blind spots") but specific, testable claims in the form "If you use the instruments in situation X, they will fail in way Y." Each prediction should be concrete enough that a single tester could confirm or refute it. The predictions should be uncomfortable — they should name the situations where the instruments are most likely to break, not the situations where they might be slightly suboptimal.
