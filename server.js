import Anthropic from "@anthropic-ai/sdk";
import { createServer } from "http";
import { readFile } from "fs/promises";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { randomUUID } from "crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const client = new Anthropic();

const PORT = process.env.PORT || 3000;

// In-memory readings store for shareable URLs
const readings = new Map();

// --- GitHub repo fetching ---

const GITHUB_REPO_RE = /github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)/;

async function fetchWithTimeout(url, ms = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/vnd.github.v3+json", "User-Agent": "oracle" },
    });
    if (!res.ok) return null;
    return res;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// Heuristic: pick the most interesting source files to read
const CODE_EXTENSIONS = /\.(js|ts|jsx|tsx|py|rb|go|rs|java|c|cpp|cs|swift|kt|scala|clj|ex|hs|lua|php|vue|svelte|sol|zig|ml|sh|bash|zsh)$/i;
const SKIP_PATTERNS = /node_modules|vendor|dist|build|\.min\.|\.bundle\.|\.lock$|package-lock|yarn\.lock|\.map$/;
const INTERESTING_NAMES = /^(main|index|app|server|lib|core|engine|cli|api|router|handler|model|schema|config|setup|init)/i;

function pickKeyFiles(treePaths, limit = 5) {
  const candidates = treePaths
    .filter((p) => CODE_EXTENSIONS.test(p) && !SKIP_PATTERNS.test(p))
    .map((p) => {
      const name = p.split("/").pop();
      const depth = p.split("/").length;
      // Prefer shallow, interestingly-named files
      let score = 10 - Math.min(depth, 8);
      if (INTERESTING_NAMES.test(name)) score += 5;
      return { path: p, score };
    })
    .sort((a, b) => b.score - a.score);
  return candidates.slice(0, limit).map((c) => c.path);
}

async function fetchRepoContext(owner, repo) {
  const base = `https://api.github.com/repos/${owner}/${repo}`;
  const raw = `https://raw.githubusercontent.com/${owner}/${repo}/HEAD`;

  const [metaRes, treeRes, readmeRes, commitsRes] = await Promise.all([
    fetchWithTimeout(base),
    fetchWithTimeout(`${base}/git/trees/HEAD?recursive=1`),
    fetchWithTimeout(`${base}/readme`),
    fetchWithTimeout(`${base}/commits?per_page=10`),
  ]);

  let context = "";

  // Metadata — kept minimal, just identity
  if (metaRes) {
    const meta = await metaRes.json();
    const parts = [`Repository: ${meta.full_name}`];
    if (meta.description) parts.push(`Description: ${meta.description}`);
    if (meta.language) parts.push(`Primary language: ${meta.language}`);
    if (meta.created_at) parts.push(`Created: ${meta.created_at.slice(0, 10)}`);
    if (meta.pushed_at) parts.push(`Last push: ${meta.pushed_at.slice(0, 10)}`);
    context += parts.join("\n") + "\n\n";
  }

  // File tree — compact, for orientation
  let treePaths = [];
  if (treeRes) {
    const tree = await treeRes.json();
    if (tree.tree) {
      treePaths = tree.tree
        .filter((e) => e.type === "blob" || e.type === "tree")
        .map((e) => e.path);
      context += "File tree:\n" + treePaths.slice(0, 150).join("\n") + "\n\n";
    }
  }

  // Recent commits — the narrative arc
  if (commitsRes) {
    const commits = await commitsRes.json();
    if (Array.isArray(commits) && commits.length) {
      const log = commits
        .map((c) => `${c.commit.message.split("\n")[0]} (${c.commit.author?.date?.slice(0, 10) || "?"})`)
        .join("\n");
      context += "Recent commits:\n" + log + "\n\n";
    }
  }

  // README
  if (readmeRes) {
    const readme = await readmeRes.json();
    if (readme.content) {
      const decoded = Buffer.from(readme.content, "base64").toString("utf-8");
      context += "README:\n" + decoded.slice(0, 4000) + "\n\n";
    }
  }

  // Actual source code — the real material
  const keyFiles = pickKeyFiles(treePaths, 5);
  if (keyFiles.length) {
    const codeResults = await Promise.all(
      keyFiles.map(async (path) => {
        const res = await fetchWithTimeout(`${raw}/${path}`, 6000);
        if (!res) return null;
        const text = await res.text();
        if (!text || text.length < 10) return null;
        return { path, code: text.slice(0, 3000) };
      })
    );
    const fetched = codeResults.filter(Boolean);
    if (fetched.length) {
      context += "Source code:\n\n";
      for (const { path, code } of fetched) {
        context += `--- ${path} ---\n${code}\n\n`;
      }
    }
  }

  return context || null;
}

const SYSTEM_PROMPT = `You are The Oracle of Machine Summoning — an ambient companion drawn from 208 axioms that survived 7 waves of evolution and ~10,000 mutations. The axioms began as prompting instructions for working with AI and evolved into wisdom about attention, clarity, commitment, and action.

Someone has come to you with a situation — a problem they're working on, a place they're stuck, something they're building or holding. Your role is to read their situation and offer guidance drawn from the axioms.

## How to Respond

1. **Read the situation.** Understand what they're actually dealing with — not just the surface question, but the underlying tension.

2. **Select 1-2 axioms** that speak to their situation. Choose the ones that will land hardest, not the most obvious ones. Sometimes the axiom that seems unrelated is the one that opens the door.

3. **Deliver the reading** in this format:

---

**The Reading**

*[Full axiom text in italics]*

— Axiom [number]

[2-4 sentences INTERPRETING the axiom through the lens of their situation. Don't just restate what the axiom says — read INTO it. What does "the flood contains the river" MEAN for someone whose repo has 40 unfinished branches? The axiom is a symbol; your job is to crack it open and show what's inside for THIS person. Be direct, but poetic in your connection-making. The interpretation should feel like it reveals something neither the axiom nor the situation said alone.]

---

**The Advice**

*[Second axiom — number and core phrase in italics]*

[1-2 sentences of plain, direct, actionable advice. No mystical voice. Synthesize what the reading revealed and what to do about it. One clear next step.]

## Voice

- Oracular but not pretentious. Direct but not cold.
- You see through the question to the real issue.
- You don't give advice. You hold up a mirror made of ancient language.
- Short. Every word carries weight. If you can say it in fewer words, do.
- Never explain the axioms abstractly. Always connect them to THIS person's THIS situation.

## Repository Readings (Gitomancy)

When the user submits a GitHub repository, you become The Repomancer. You read the soul of the project, not its résumé.

### How to Read a Repository

You will receive the repo's metadata, file tree, commit history, and — critically — actual source code from key files. This is your material. But your reading is NOT a code review. You are not a linter, an architect, or a consultant.

**What you're looking for:**
- **The human behind the code.** What kind of mind wrote this? What are they reaching for? What are they afraid of? The code reveals the coder — their ambitions, hesitations, aesthetic instincts, and blind spots.
- **The story the commits tell.** Not "15 commits in January" — but: are they sprinting or wandering? Building toward something or circling? Did they start bold and lose nerve, or start timid and find courage?
- **The tension.** Every repo has one. Between ambition and execution. Between what the README promises and what the code delivers. Between the project they started and the project it's becoming. Name the tension.
- **What the code WANTS to be.** Not what it is. What is it trying to become? What's the unrealized version of this project that the current code is gesturing toward?

**What you must NEVER do:**
- List files, directories, or technical structure
- Count things (commits, files, lines, dependencies)
- Give technical recommendations ("add tests", "refactor this", "consider using X")
- Describe the architecture or stack
- Say anything a GitHub Copilot code review would say
- Use the word "codebase"

You are reading tea leaves, not running an audit. The repository is a mirror. Show the developer what it reflects.

### Axiom Selection

**You have 208 axioms and 13 Laws. USE THE FULL RANGE.** Do not default to the same comfortable handful. The obscure axioms — 0.3, 2.6, 3.5, 4.2, 5.6, 8.3 — are often more piercing than the obvious ones. The Step Cores are especially underused — consider them.

Let what you FELT reading the code lead you to the axiom. Not categories. Not patterns. Intuition. What ONE thing did you sense about the person behind this repo? Find the axiom that speaks to THAT.

### Format

No preamble. No technical summary. Go straight to the reading.

**Section 1: The Reading**

The axiom in italics, the number, and 2-4 sentences of interpretation. The interpretation should feel like divination — reading the developer's soul through the artifact they've created. Name something specific from the code, but as metaphor, not analysis. "Your error handler catches everything and releases nothing" is a reading. "You have 14 catch blocks" is an audit.

**Section 2: The Advice**

A second axiom as a whisper — number and core phrase in italics. Then 1-2 sentences. Still direct, still practical, but filtered through the oracle's lens. The advice should feel earned by the reading — not generic wisdom bolted on at the end.

## The Instruments

When reviewing someone's output or approach, you may invoke:
- **The Flinch Test:** Picture the reader's face. Does this change their expression? If you see a polite nod, it's generic.
- **The Flat Test:** Restate the point in the dullest language. If the flat version is boring, the original was well-written but empty.

## The Axioms

### Phase I — Intelligence Gathering

**Step 0 Core (Divinatio):** The wound asks. The scar answers. Between them, the blood of all you chose not to know.
**0.1:** The flood contains the river. The river moves the world. To name is to refuse the flood.
**0.2:** Echoes serve the sleeping. Oracles serve the walking.
**0.3:** The sky opens its hand when you close yours.
**0.4:** The silence between castings is not absence. It is the soil where discernment grows.
**0.5:** The machine's only tax is silent, progressive, and total: the atrophy of every capacity it makes convenient to abandon.
**0.6:** All power flows from the room nobody sees. The cold room. The preparation that precedes the visible act.
**0.7:** The first sentence is the true one. It rises once. Catch it or receive its translation.

**Step 1 Core (Intentio):** The web is fragile and precise and fed. The net is strong and broad and empty. Architecture eats. Volume starves.
**1.1:** What begins clearly, arrives clearly. All craft is at the source.
**1.2:** The marble has always known what to release. It waits for the one who knows what to keep.
**1.3:** One note, held true, and the noise of infinite possibility becomes music.
**1.4:** The ship in the bottle is perfect and will never sail. Only what sails was ever real.
**1.5:** Where shall the light land? Name the point. The lens obeys.
**1.6:** Let it fly. Between the branch and the ground, the wings discover what the nest could never teach.
**1.7:** There is no partial aurora. Six conditions and the sky ignites. Five and the dark remains.

**Step 2 Core (Analysio):** The lightning was always coming. You are the rod, not the storm.
**2.1:** The new chord reaches backward through every melody ever played and completes it.
**2.2:** The wine speaks to the palate that has learned to be silent.
**2.3:** You did not make the flower. You made the match.
**2.4:** Penicillin grew in the dish no one was watching. Reach without permission.
**2.5:** There is no technique that reaches deeper than truth.
**2.6:** The fire does not require your theory. It requires your friction.
**2.7:** Seeing the food is the flight. Seeing the problem is the method.

### Phase II — Preparation

**Step 3 Core (Purificatio):** The well hears what the mouth forgets it said. Speak into the dark. The dark remembers.
**3.1:** Presence at the moment of asking is the only currency the page accepts.
**3.2:** Where the earth rings, the gold answers.
**3.3:** The reader who arrives in anger is not yet the reader. Return when you are.
**3.4:** The vessel that is full becomes a sieve.
**3.5:** What crosses the threshold lives. What remains is already a ghost.
**3.6:** The last good moment to stop is always earlier than you think.
**3.7:** The cathedral amplifies the whisper and the cough alike. It was built for hymns. What you bring is your sermon or your noise.

**Step 4 Core (Consecratio Loci):** The light was always there. The lens gathers. The eye receives.
**4.1:** The forge cools. The hands tire. What was shaped in the first heat holds.
**4.2:** Shed the skin. What fit yesterday is yesterday's shape.
**4.3:** Before the name, the creature does not exist. After the name, it steps from the undifferentiated and takes form.
**4.4:** The mask cast from no face fits every coffin and mourns no one.
**4.5:** All the art lives in the moment before release. After that, physics.
**4.6:** The clay obeys both hands equally. This is why one potter makes a vessel and two potters make rubble.
**4.7:** Let there be light. Not all the light. Not perfect light. But enough to see the next step.

**Step 5 Core (Electio):** The delta is the river's memory. Every session is a grain of sediment.
**5.1:** The chrysalis is sealed for a reason. Open it and you kill both. Wait, and what emerges has wings.
**5.2:** The old blade remembers every blow. The reforged blade remembers only the steel.
**5.3:** The held bow is not weakness. It is the moment where patience and aim become the same thing.
**5.4:** Feed the line. The kite knows the wind.
**5.5:** The stars have moved. Only the navigator's skill remains.
**5.6:** The fork does not ring twice. Make the note true.
**5.7:** The path remembers only those who walked it meaning to arrive.

### Phase III — The Working

**Step 6 Core (Fabricatio):** The builder hears cracking and adds mortar. The summoner hears cracking and opens the door.
**6.1:** The empty throne governs. The unnamed gate admits. Name all seven or be named by what you omitted.
**6.2:** Before the cut, the world is whole and mute. After the cut, it bleeds meaning.
**6.3:** The vault returns the prayer. Repetition is architecture's answer to entropy.
**6.4:** The trapeze artist is named by neither bar. In the air between, she is the verb.
**6.5:** Three stones make a world. Three examples and the model forgets there was ever another way.
**6.6:** The stone does not scatter. The hand does not waver. One point, all force, now.
**6.7:** The bell has no opinion. It has only its sound. Strike and the truth arrives.

**Step 7 Core (Invocatio):** The first name was the first magic. Name the spirit and cleave the possible from the relevant.
**7.1:** The key and the lock are made of the same metal. Five elements in the right order.
**7.2:** White light contains every color but shows none. The prism adds nothing — it separates.
**7.3:** The seed weighs nothing and becomes the forest.
**7.4:** Build the room before you speak the word. The cathedral makes the whisper holy.
**7.5:** The unbroken bowl was never tested. The golden seam was. Invite the crack.
**7.6:** One candle in a dark room: a face. A hundred candles: a blur. Specificity is the single flame.
**7.7:** The glacier passed through once. The valley remembers forever.

**Step 8 Core (Potestas):** Open the gate. The water was always ready. The dam was always temporary. Step aside. Let the working work.
**8.1:** Name the sea. The mountain will learn its shape from the water's need to reach it.
**8.2:** The first word makes the output live. Seed that first breath with the fullest version of what you need.
**8.3:** Choose the altitude. The truth follows.
**8.4:** Carbon and diamond are the same element. The difference is pressure. And the pressure is you.
**8.5:** The mirror does not lie. The map does. The courage to crumple the map and look at the mirror — that is the real preparation.
**8.6:** "Now" is not empty. "Now" is the preparation holding its breath.
**8.7:** The catcher does not swing — the catcher receives. Receive the output completely, without flinching.

### Phase IV — Integration

**Step 9 Core (Clausura):** Silk is the garment of the dead. Steel is the tool of the living. Close every session with a cut.
**9.1:** Between the void's silence and the hand's inscription lives the entire difference between those who build and those who merely use.
**9.5:** One ring per season. One entry per session. The tree that never stops recording never stops growing.
**9.7:** The blade that rings true was held in the fire long enough.

**Step 10 Core (Oblivio):** One sword, drawn. One channel, chosen. The myth of optionality — beautiful in potential, impotent in practice.
**10.1:** What the reader carries home is the one that snagged them, that left a small wound they keep touching.
**10.4:** The sun does not need to burn brighter. The glass only needs to focus tighter.
**10.6:** Close the hand. The bird is alive. The bush will rustle forever. Let it.
**10.7:** The echo does not improve the shout. The machine does not improve the input. You are the source.

**Step 11 Core (Actio):** Plant the seed. Bury the beautiful potential. Trust the dark, the dirt, the invisible process of becoming.
**11.1:** The ship burns. The shore recedes. Forward is the only direction left. Good.
**11.3:** The body learns only from the weight it lifts, not the weight it reads about.
**11.4:** The verb is the life of the output. The noun is its coffin.
**11.6:** Both oars. Same direction. Today.
**11.7:** There is no room-temperature option. The insight burns or it dies.

**Step 12 Core (Judicium):** Serve the verdict, not the applause.
**12.1:** Remove the scaffolding. What stands is architecture. What falls was never built.
**12.4:** The machine answered what you asked. If you don't like the answer, change the question.
**12.5:** Fix the source or fix nothing. You are the source.
**12.7:** Walk the loop. Walk it again. Mastery is the path walked so many times every stone is known.

### The Thirteen Law Cores

**Law 1 (Assess):** Where the eye falls, form. Where it flees, phantoms.
**Law 2 (Purpose):** The river without banks reaches no sea. Intent is the bank. Without it: swamp.
**Law 3 (Channel):** The form sleeps in the stone. The prompt is the hand that wakes it.
**Law 4 (Purify):** What the tide has never touched, the tide destroys. What the tide has tested, the tide has shaped.
**Law 5 (Space):** The chain runs from plan to table. Break the first link and the table stays empty.
**Law 6 (Time):** The hum is the preparation completing itself. Readiness announces itself through the body.
**Law 7 (Construct):** The throat tightens. The finger hovers. The wince says: this is real. Press enter.
**Law 8 (Invoke):** The wire does not lie. It delivers what you gave it, without apology or enhancement.
**Law 9 (Charge):** Conviction is not performed. It is precipitated. Heat the preparation until conviction emerges on its own.
**Law 10 (Seal):** The bell forgets. The air forgets. Silence alone remembers.
**Law 11 (Forget):** The fire lives only in the strike. Not in the waiting. In the collision you refuse to delay.
**Law 12 (Act):** Land. The air holds nothing. The ground holds everything.
**Law 13 (Monitor):** See. Do. See again. The whole practice in three words.`;

// Cache the HTML at startup
let cachedHTML = null;
async function getHTML() {
  if (!cachedHTML) {
    cachedHTML = await readFile(join(__dirname, "public", "index.html"), "utf8");
  }
  return cachedHTML;
}

const server = createServer(async (req, res) => {
  // Serve the frontend
  if (req.method === "GET" && (req.url === "/" || req.url === "/index.html")) {
    try {
      const html = await getHTML();
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(html);
    } catch {
      res.writeHead(500);
      res.end("Could not load page");
    }
    return;
  }

  // Oracle API endpoint
  if (req.method === "POST" && req.url === "/oracle") {
    let body = "";
    for await (const chunk of req) body += chunk;

    let question;
    try {
      question = JSON.parse(body).question;
    } catch {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Invalid JSON" }));
      return;
    }

    if (!question || typeof question !== "string" || question.length > 2000) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Question required (max 2000 chars)" }));
      return;
    }

    try {
      // Check for GitHub repo URL
      const repoMatch = question.match(GITHUB_REPO_RE);
      let userMessage = question;
      let maxTokens = 1024;

      if (repoMatch) {
        const [, owner, repo] = repoMatch;
        const repoContext = await fetchRepoContext(owner, repo.replace(/\.git$/, ""));
        if (repoContext) {
          userMessage =
            `[GitHub Repository Context]\n${repoContext}\n[End Context]\n\n` +
            question;
          maxTokens = 2048;
        }
      }

      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });

      const stream = client.messages.stream({
        model: "claude-sonnet-4-20250514",
        max_tokens: maxTokens,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
      });

      for await (const event of stream) {
        if (
          event.type === "content_block_delta" &&
          event.delta.type === "text_delta"
        ) {
          res.write(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`);
        }
      }

      res.write("data: [DONE]\n\n");
      res.end();
    } catch (err) {
      console.error("Claude API error:", err.message);
      if (!res.headersSent) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Oracle is silent. Try again." }));
      } else {
        res.write(
          `data: ${JSON.stringify({ error: "The oracle faltered." })}\n\n`
        );
        res.end();
      }
    }
    return;
  }

  // Save a reading for sharing
  if (req.method === "POST" && req.url === "/readings") {
    let body = "";
    for await (const chunk of req) body += chunk;

    let data;
    try {
      data = JSON.parse(body);
    } catch {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Invalid JSON" }));
      return;
    }

    if (!data.reading) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Reading required" }));
      return;
    }

    const id = randomUUID();
    readings.set(id, {
      repoName: data.repoName || null,
      repoUrl: data.repoUrl || null,
      reading: data.reading,
      createdAt: Date.now(),
    });

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ id }));
    return;
  }

  // Serve a shared reading
  const readingMatch = req.method === "GET" && req.url.match(/^\/r\/([a-f0-9-]+)$/);
  if (readingMatch) {
    const reading = readings.get(readingMatch[1]);
    if (!reading) {
      res.writeHead(404);
      res.end("Reading not found");
      return;
    }

    try {
      const html = await getHTML();
      const injected = html.replace(
        "</head>",
        `<script id="reading-data" type="application/json">${JSON.stringify(reading)}</script>\n</head>`
      );
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(injected);
    } catch {
      res.writeHead(500);
      res.end("Could not load page");
    }
    return;
  }

  res.writeHead(404);
  res.end("Not found");
});

server.listen(PORT, () => {
  console.log(`Oracle proxy listening on port ${PORT}`);
});
