# Wave 12: Where Generic Is the Point

## Previous Wave's Forward Instruction
"The instruments work on single outputs. Now stress-test them on something they might not handle: a domain where 'generic' is the correct answer. Apply them to technical documentation, safety warnings, legal language, or standardized procedures — places where specificity to the individual might be wrong and the general case is the point. See if they break or adapt."

## Application

### Cycle 1: A Safety Warning on a Chainsaw

The existing warning label on a consumer chainsaw reads:

> WARNING: To reduce the risk of serious injury, read and understand the operator's manual before using this product. Wear proper protective equipment including eye protection, hearing protection, gloves, and steel-toed boots. Never operate while fatigued, under the influence of drugs or alcohol, or in poor lighting conditions. Keep all guards in place.

**Flinch Test:** Does anyone's body respond? Actually — no. And this is the problem the entire safety-communication field has been fighting for decades. Chainsaw warning labels save approximately zero lives because they produce zero bodily response. The user's eyes slide off them. They're generic not because they should be, but because the safety industry decided generic was "correct" and accepted the consequence that no one reads the labels.

**Now try a specific version:**
"This chainsaw will cut through your thigh bone in less than half a second. It does not care that you've used one before. Last year, 36,000 Americans went to the emergency room for chainsaw injuries — the majority were experienced users who skipped the chaps. Wear leg protection. Every time. No exceptions."

**Flinch Test:** The body responds to "cut through your thigh bone in less than half a second." The statistic about experienced users challenges the most dangerous assumption (I know what I'm doing). "It does not care that you've used one before" is specific to the mental state of the person most likely to be hurt.

**Flat Test on the specific version:** "Chainsaws cause serious injuries, mostly to experienced users who don't wear protection. Wear leg protection." Survives — still specific (experienced users, leg protection specifically), still carries the key insight (experience doesn't protect you, equipment does).

**What this reveals:** The instruments didn't break. They revealed that the "generic is correct" assumption in safety communication is itself the problem. The standard warning label fails the Flinch Test and that failure has a body count. The instruments argue, persuasively, that safety warnings SHOULD be specific — and the field of behavioral safety design agrees. The generic-is-correct assumption in safety labeling is a regulatory artifact, not an effectiveness finding.

### Cycle 2: API Documentation

Here's a standard API endpoint description:

> `POST /api/v2/users`
> Creates a new user account. Requires authentication. Request body must include `email` (string, required), `name` (string, required), and `role` (string, optional, defaults to "viewer"). Returns 201 on success with the created user object. Returns 400 if required fields are missing. Returns 409 if email already exists.

**Flinch Test:** There's no flinch, but there shouldn't be. This is reference documentation. The developer's "body response" is either "I found what I need" or "I didn't." The documentation is specific — specific endpoint, specific fields, specific error codes. It refers to particular things, not general things.

**Flat Test:** It's already flat. API docs are written in the dullest possible language by convention. You can't deflate further. And the content survives because it was never inflated — it's pure reference information.

**What this reveals:** The instruments don't break on API docs — they simply have nothing to do. API documentation is pre-deflated. It's already specific (this endpoint, these fields, these errors). The Flinch Test and Flat Test both return "fine" because the document was never trying to be anything other than what it is. The instruments' domain is work where inflation is possible. Reference documentation is outside that domain.

But wait — bad API docs DO exist, and they fail the tests. Consider:

> `POST /api/v2/users`
> This powerful endpoint allows you to seamlessly create new user accounts in our robust platform. Simply pass the required parameters and our system will handle the rest!

**Flinch Test:** Marketing language in a docs page. The developer flinches — with irritation. "Powerful," "seamlessly," "robust" — these are inflations that the developer's body rejects because they're reading for information, not persuasion.

**Flat Test:** "This endpoint creates a user. Pass the parameters." The flat version reveals the marketing language was empty calories. The original added no information the flat version lacks.

So the instruments DO work on technical documentation — but only when the documentation has been contaminated by rhetoric. Clean docs are already in the instruments' target state. Dirty docs fail the tests the same way any inflated writing does.

### Cycle 3: Legal Boilerplate — A Terms of Service Agreement

Standard ToS opening:

> By accessing or using our Service, you agree to be bound by these Terms. If you disagree with any part of the terms, you may not access the Service. Our Service may contain links to third-party websites or services that are not owned or controlled by the Company.

**Flinch Test:** No flinch. But here's the interesting question — is that a problem? Legal boilerplate exists to establish legal relationships, not to communicate. It's written for judges, not users. The "audience" whose body should respond is a future courtroom, and in that courtroom, the generic language is precisely what's needed — it establishes standard legal relationships using standard legal terms that have established case law behind them.

**Now try to make it specific:**
"When you create an account, you're entering a contract. We can change the terms. We can terminate your access. We own the platform; you own your data — until you delete your account, at which point we keep anonymized analytics derived from your usage for up to 24 months. If you sue us, it goes to arbitration in Delaware. Read that sentence again: you're agreeing to arbitration, not a jury trial."

**Flinch Test:** Multiple flinches. "We keep anonymized analytics for 24 months" — most users didn't know that. "You're agreeing to arbitration, not a jury trial" — the direct address forces recognition of what they're signing.

**Flat Test:** "Creating an account is a contract. The company can change terms and terminate access. They keep some data after deletion. Disputes go to arbitration." Survives — still specific, still informative.

**But here's the problem:** the specific version is legally more dangerous for the company. By calling attention to the arbitration clause, they make it harder to enforce — a user who was explicitly warned has stronger grounds to argue the clause was unconscionable if they can show the warning was buried. The standard boilerplate works legally BECAUSE no one reads it. The generic-ness is a feature, not a bug, from the company's legal perspective.

**What this reveals:** The instruments expose a genuine ethical tension. Legal boilerplate is generic on purpose — not because clarity is impossible but because opacity serves the drafter's interests. The Flinch Test doesn't break here; it reveals that the generic-ness is a strategy, not an accident. The instruments become diagnostic tools for identifying where generic language is being used to obscure rather than to communicate. That's not what they were designed for, but it's what they do.

### Cycle 4: Standardized Medical Discharge Instructions

Post-appendectomy discharge instructions:

> Rest for 1-2 weeks. Avoid heavy lifting (over 10 lbs) for 4-6 weeks. You may shower 24 hours after surgery but do not submerge the incision. Call your doctor if you experience fever above 101.5°F, increasing redness or swelling around the incision, or persistent vomiting.

**Flinch Test:** Interesting — this is generic (applies to every appendectomy patient) but specific (10 lbs, 4-6 weeks, 101.5°F, 24 hours). The numbers do the specificity work. A patient reading "fever above 101.5°F" has a clear threshold — their body knows what to watch for. "Increasing redness" gives them a visual standard. These are generic instructions that achieve specificity through precise thresholds.

**Flat Test:** Already flat. Medical discharge instructions are written plainly by design. Can't deflate further.

**Try to make them more specific to the individual:**
"Mrs. Torres, you had a laparoscopic appendectomy. Your incision is 1.5 inches long, lower right abdomen. You're a mail carrier, so the 10-pound lifting restriction means you cannot carry your mail bag for 4-6 weeks — talk to your supervisor about light duty before you go back. Your blood pressure was slightly elevated during surgery (148/92), so if you notice headaches along with any fever, call us immediately rather than waiting."

**Flinch Test:** Mrs. Torres flinches — the mail bag detail tells her this applies to her life, not to a generic patient. The blood pressure detail connects her surgical record to her recovery instructions. This is visibly better patient communication.

**Flat Test:** "Your specific job and blood pressure mean you need modified recovery instructions." Still specific — it's about this patient's body and this patient's job.

**What this reveals:** The standardized instructions are a floor, not a ceiling. They're specific enough to be safe (the thresholds are real and useful) but not specific enough to be effective for individual patients. The instruments don't argue against standardization — they argue that standardization should be a starting template that gets customized, not a finished product. The generic version isn't wrong. It's incomplete.

## What Happened

The instruments didn't break. Across four "generic-is-correct" domains, they revealed something more nuanced than I expected: generic-ness is almost never actually correct. It's either a regulatory artifact (safety labels), a non-issue (clean technical docs), a deliberate opacity strategy (legal boilerplate), or an incomplete floor (medical instructions).

The safety warning was the most striking case. The instruments argued that the generic chainsaw label is itself a failure — and the behavioral safety literature agrees. Thirty-six thousand ER visits a year is the body count of generic communication.

The legal boilerplate case was the most complex. The instruments didn't just diagnose generic-ness; they diagnosed strategic opacity — revealing that the generic-ness serves the drafter's interests at the reader's expense. The instruments became ethical diagnostic tools almost accidentally.

The API docs case was the simplest: clean reference documentation is already in the instruments' target state. They have nothing to do there. But they catch inflated docs instantly.

The medical instructions case revealed the instruments' most useful application in this domain: not replacing standardized procedures, but arguing that standardization should be a template, not a terminus.

The "generic is correct" challenge produced no break. It produced a refinement: the instruments can distinguish between communication that's appropriately concise and communication that's strategically or lazily vague. Concision passes both tests. Vagueness fails.

## Forward Instruction
The instruments have now been applied to creative work (Wave 11) and to domains that resist specificity (Wave 12), and they held in both. The pattern emerging is that they're diagnostic — they catch what's wrong but don't generate what's right. Wave 13 should test that boundary: can the instruments be used generatively, not just diagnostically? Try to use them to CREATE something from scratch — not to critique after the fact, but to guide the making in real time. Write something (a short story, a speech, a pitch, a letter) using the instruments as active constraints during composition, not as post-hoc evaluators. See if the process is different.
