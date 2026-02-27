import Anthropic from "@anthropic-ai/sdk";
import { fetchRepoContext, PERCEPTION_PROMPT, READING_PROMPT } from "./server.js";
import { writeFile, readFile, mkdir } from "fs/promises";
import { existsSync } from "fs";

const client = new Anthropic();
const RESULTS_DIR = "test-results";
const READINGS_FILE = `${RESULTS_DIR}/readings.json`;
const ANALYSIS_FILE = `${RESULTS_DIR}/analysis.md`;

// ─── 50 Repos: maximum diversity ───────────────────────────────────

const REPOS = [
  // CLI Tools
  { owner: "sharkdp", repo: "bat", category: "cli", lang: "Rust" },
  { owner: "junegunn", repo: "fzf", category: "cli", lang: "Go" },
  { owner: "BurntSushi", repo: "ripgrep", category: "cli", lang: "Rust" },
  { owner: "charmbracelet", repo: "glow", category: "cli", lang: "Go" },
  { owner: "jarun", repo: "nnn", category: "cli", lang: "C" },

  // Web Frameworks
  { owner: "sveltejs", repo: "svelte", category: "web", lang: "JS/TS" },
  { owner: "rails", repo: "rails", category: "web", lang: "Ruby" },
  { owner: "django", repo: "django", category: "web", lang: "Python" },
  { owner: "phoenixframework", repo: "phoenix", category: "web", lang: "Elixir" },
  { owner: "vapor", repo: "vapor", category: "web", lang: "Swift" },

  // Data Science / ML
  { owner: "huggingface", repo: "transformers", category: "ml", lang: "Python" },
  { owner: "scikit-learn", repo: "scikit-learn", category: "ml", lang: "Python" },
  { owner: "duckdb", repo: "duckdb", category: "ml", lang: "C++" },
  { owner: "apache", repo: "spark", category: "ml", lang: "Scala" },
  { owner: "pola-rs", repo: "polars", category: "ml", lang: "Rust" },

  // DevOps / Infrastructure
  { owner: "hashicorp", repo: "terraform", category: "devops", lang: "Go" },
  { owner: "ansible", repo: "ansible", category: "devops", lang: "Python" },
  { owner: "containers", repo: "podman", category: "devops", lang: "Go" },
  { owner: "traefik", repo: "traefik", category: "devops", lang: "Go" },
  { owner: "grafana", repo: "grafana", category: "devops", lang: "Go/TS" },

  // Creative / Art
  { owner: "processing", repo: "p5.js", category: "creative", lang: "JS" },
  { owner: "sonic-pi-net", repo: "sonic-pi", category: "creative", lang: "Ruby/C++" },
  { owner: "openframeworks", repo: "openFrameworks", category: "creative", lang: "C++" },
  { owner: "hydra-synth", repo: "hydra", category: "creative", lang: "JS" },
  { owner: "tidalcycles", repo: "Tidal", category: "creative", lang: "Haskell" },

  // Games / Engines
  { owner: "godotengine", repo: "godot", category: "games", lang: "C++" },
  { owner: "bevyengine", repo: "bevy", category: "games", lang: "Rust" },
  { owner: "raysan5", repo: "raylib", category: "games", lang: "C" },
  { owner: "phaserjs", repo: "phaser", category: "games", lang: "JS" },
  { owner: "love2d", repo: "love", category: "games", lang: "C++/Lua" },

  // Compilers / Languages
  { owner: "ziglang", repo: "zig", category: "compilers", lang: "Zig" },
  { owner: "vlang", repo: "v", category: "compilers", lang: "V" },
  { owner: "gleam-lang", repo: "gleam", category: "compilers", lang: "Rust" },
  { owner: "elm", repo: "compiler", category: "compilers", lang: "Haskell" },
  { owner: "crystal-lang", repo: "crystal", category: "compilers", lang: "Crystal" },

  // Libraries
  { owner: "lodash", repo: "lodash", category: "libraries", lang: "JS" },
  { owner: "pallets", repo: "flask", category: "libraries", lang: "Python" },
  { owner: "tokio-rs", repo: "tokio", category: "libraries", lang: "Rust" },
  { owner: "gin-gonic", repo: "gin", category: "libraries", lang: "Go" },
  { owner: "expressjs", repo: "express", category: "libraries", lang: "JS" },

  // Hardware / Embedded
  { owner: "micropython", repo: "micropython", category: "hardware", lang: "C/Python" },
  { owner: "espressif", repo: "arduino-esp32", category: "hardware", lang: "C++" },
  { owner: "raspberrypi", repo: "pico-sdk", category: "hardware", lang: "C" },

  // Tiny / Minimal
  { owner: "antirez", repo: "kilo", category: "tiny", lang: "C" },
  { owner: "kelseyhightower", repo: "nocode", category: "tiny", lang: "None" },
  { owner: "dylanaraps", repo: "pure-bash-bible", category: "tiny", lang: "Shell" },

  // Massive Titans
  { owner: "microsoft", repo: "vscode", category: "titan", lang: "TS" },
  { owner: "torvalds", repo: "linux", category: "titan", lang: "C" },
  { owner: "rust-lang", repo: "rust", category: "titan", lang: "Rust" },
  { owner: "neovim", repo: "neovim", category: "titan", lang: "C/Lua" },
];

// ─── Complete axiom catalog (from system prompt) ───────────────────

function buildAxiomCatalog() {
  const axioms = [];
  // Steps 0-8: full 7 corollaries + core each
  for (let s = 0; s <= 8; s++) {
    axioms.push(`Step ${s} Core`);
    for (let c = 1; c <= 7; c++) axioms.push(`${s}.${c}`);
  }
  // Steps 9-12: sparse
  axioms.push("Step 9 Core", "9.1", "9.5", "9.7");
  axioms.push("Step 10 Core", "10.1", "10.4", "10.6", "10.7");
  axioms.push("Step 11 Core", "11.1", "11.3", "11.4", "11.6", "11.7");
  axioms.push("Step 12 Core", "12.1", "12.4", "12.5", "12.7");
  // Laws
  for (let l = 1; l <= 13; l++) axioms.push(`Law ${l}`);
  return axioms;
}

const ALL_AXIOMS = buildAxiomCatalog();

// ─── Axiom extraction from reading text ────────────────────────────

function extractAxioms(text) {
  const found = new Set();

  // "Axiom X.Y" — standard citation format
  for (const m of text.matchAll(/Axiom\s+(\d+\.\d+)/gi)) {
    found.add(m[1]);
  }

  // "— X.Y" — dash-prefixed citation
  for (const m of text.matchAll(/—\s*(\d+\.\d+)/g)) {
    found.add(m[1]);
  }

  // "*X.Y:" — inline in italics
  for (const m of text.matchAll(/\*(\d+\.\d+)\s*:/g)) {
    found.add(m[1]);
  }

  // "Law X" — law references
  for (const m of text.matchAll(/Law\s+(\d{1,2})\b/gi)) {
    const num = parseInt(m[1]);
    if (num >= 1 && num <= 13) found.add(`Law ${num}`);
  }

  // "Step X Core" — step core references
  for (const m of text.matchAll(/Step\s+(\d+)\s+Core/gi)) {
    found.add(`Step ${m[1]} Core`);
  }

  return [...found];
}

// ─── Run a single reading ──────────────────────────────────────────

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

// ─── N-gram extraction for similarity analysis ─────────────────────

function extractNgrams(text, n = 5) {
  const words = text
    .toLowerCase()
    .replace(/[^\w\s']/g, "")
    .split(/\s+/)
    .filter(Boolean);
  const ngrams = [];
  for (let i = 0; i <= words.length - n; i++) {
    ngrams.push(words.slice(i, i + n).join(" "));
  }
  return ngrams;
}

// ─── Analysis engine ───────────────────────────────────────────────

function analyze(readings) {
  const totalReadings = readings.length;

  // 1. Axiom frequency
  const axiomCounts = {};
  for (const ax of ALL_AXIOMS) axiomCounts[ax] = 0;

  const readingAxioms = readings.map((r) => {
    const axioms = extractAxioms(r.text);
    for (const ax of axioms) {
      if (ax in axiomCounts) axiomCounts[ax]++;
      else axiomCounts[ax] = 1; // unlisted axiom (model hallucinated a number)
    }
    return axioms;
  });

  const sorted = Object.entries(axiomCounts).sort((a, b) => b[1] - a[1]);
  const used = sorted.filter(([, c]) => c > 0);
  const unused = sorted.filter(([, c]) => c === 0).map(([ax]) => ax);
  const top10 = used.slice(0, 10);

  // 2. Word count distribution
  const wordCounts = readings.map(
    (r) => r.text.split(/\s+/).filter(Boolean).length,
  );
  const wcSorted = [...wordCounts].sort((a, b) => a - b);
  const wcMean = wordCounts.reduce((a, b) => a + b, 0) / totalReadings;
  const wcMedian =
    totalReadings % 2 === 0
      ? (wcSorted[totalReadings / 2 - 1] + wcSorted[totalReadings / 2]) / 2
      : wcSorted[Math.floor(totalReadings / 2)];
  const wcStdDev = Math.sqrt(
    wordCounts.reduce((sum, wc) => sum + (wc - wcMean) ** 2, 0) /
      totalReadings,
  );

  // 3. Opening patterns — first 8 words of each reading
  const openings = readings.map((r) => {
    const clean = r.text.replace(/^[\s*#\-—]+/, "").trim();
    return clean.split(/\s+/).slice(0, 8).join(" ");
  });
  const openingCounts = {};
  for (const o of openings) {
    // Group by first 3 words to find structural patterns
    const prefix = o.split(/\s+/).slice(0, 3).join(" ").toLowerCase();
    openingCounts[prefix] = (openingCounts[prefix] || 0) + 1;
  }
  const topOpenings = Object.entries(openingCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  // 4. Cross-reading similarity (5-word n-grams)
  const ngramReadings = new Map();
  for (let i = 0; i < readings.length; i++) {
    const ngrams = new Set(extractNgrams(readings[i].text));
    for (const ng of ngrams) {
      if (!ngramReadings.has(ng)) ngramReadings.set(ng, new Set());
      ngramReadings.get(ng).add(i);
    }
  }
  const repeatedPhrases = [...ngramReadings.entries()]
    .filter(([, s]) => s.size >= 4)
    .sort((a, b) => b[1].size - a[1].size)
    .slice(0, 30)
    .map(([phrase, indices]) => ({
      phrase,
      count: indices.size,
      pct: ((indices.size / totalReadings) * 100).toFixed(0),
    }));

  // 5. Axiom co-occurrence (pairs that appear together)
  const pairCounts = {};
  for (const axioms of readingAxioms) {
    const sorted = [...axioms].sort();
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const key = `${sorted[i]} + ${sorted[j]}`;
        pairCounts[key] = (pairCounts[key] || 0) + 1;
      }
    }
  }
  const topPairs = Object.entries(pairCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  // 6. Category clustering
  const categories = {};
  for (const r of readings) {
    if (!categories[r.category]) categories[r.category] = [];
    categories[r.category].push(extractAxioms(r.text));
  }
  const categoryStats = {};
  for (const [cat, axiomSets] of Object.entries(categories)) {
    const allAxioms = axiomSets.flat();
    const freq = {};
    for (const ax of allAxioms) freq[ax] = (freq[ax] || 0) + 1;
    const topAxioms = Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    const uniqueAxioms = new Set(allAxioms);
    categoryStats[cat] = {
      count: axiomSets.length,
      topAxioms,
      uniqueCount: uniqueAxioms.size,
    };
  }

  // 7. Axioms per reading distribution
  const axiomsPerReading = readingAxioms.map((a) => a.length);
  const avgAxioms =
    axiomsPerReading.reduce((a, b) => a + b, 0) / totalReadings;

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

  return {
    totalReadings,
    axiomCounts: sorted,
    used,
    unused,
    top10,
    wordCounts: {
      min: wcSorted[0],
      max: wcSorted[wcSorted.length - 1],
      mean: Math.round(wcMean),
      median: Math.round(wcMedian),
      stdDev: Math.round(wcStdDev),
    },
    topOpenings,
    repeatedPhrases,
    topPairs,
    categoryStats,
    axiomsPerReading: {
      values: axiomsPerReading,
      avg: avgAxioms.toFixed(1),
    },
    coverage: {
      total: ALL_AXIOMS.length,
      used: used.length,
      pct: ((used.length / ALL_AXIOMS.length) * 100).toFixed(1),
    },
    diagnosticLensCounts,
  };
}

// ─── Report generator ──────────────────────────────────────────────

function generateReport(analysis, readings) {
  const {
    totalReadings,
    top10,
    unused,
    wordCounts,
    topOpenings,
    repeatedPhrases,
    topPairs,
    categoryStats,
    coverage,
    axiomsPerReading,
    axiomCounts,
    diagnosticLensCounts,
  } = analysis;

  let md = `# Repomancer Reading Diversity Analysis

*${totalReadings} readings analyzed — ${new Date().toISOString().slice(0, 10)}*

---

## Axiom Coverage

**${coverage.used} of ${coverage.total} axioms cited (${coverage.pct}%)**
Average axioms per reading: ${axiomsPerReading.avg}

### Full Frequency Table

| Axiom | Citations | % of Readings |
|-------|-----------|---------------|
`;

  for (const [ax, count] of axiomCounts) {
    if (count > 0) {
      const pct = ((count / totalReadings) * 100).toFixed(0);
      const bar = "█".repeat(Math.ceil(count / 2));
      md += `| ${ax} | ${count} ${bar} | ${pct}% |\n`;
    }
  }

  md += `
### Top 10 — The Comfort Zone

These axioms dominate. The model reaches for them first.

| Rank | Axiom | Citations | % of Readings |
|------|-------|-----------|---------------|
`;

  for (let i = 0; i < top10.length; i++) {
    const [ax, count] = top10[i];
    const pct = ((count / totalReadings) * 100).toFixed(0);
    md += `| ${i + 1} | ${ax} | ${count} | ${pct}% |\n`;
  }

  md += `
### Never Cited — The Blind Spots

${unused.length} axioms never appeared across ${totalReadings} readings:

`;

  // Group unused by step
  const unusedByStep = {};
  for (const ax of unused) {
    const step = ax.match(/^(\d+)\./)?.[1] || ax.match(/Step (\d+)/)?.[1] || ax.match(/Law (\d+)/)?.[1] || "?";
    const group = ax.startsWith("Law") ? "Laws" : ax.includes("Core") ? "Cores" : `Step ${step}`;
    if (!unusedByStep[group]) unusedByStep[group] = [];
    unusedByStep[group].push(ax);
  }
  for (const [group, axioms] of Object.entries(unusedByStep)) {
    md += `- **${group}:** ${axioms.join(", ")}\n`;
  }

  md += `
---

## Structural Analysis

### Word Count Distribution

| Metric | Value |
|--------|-------|
| Min | ${wordCounts.min} |
| Max | ${wordCounts.max} |
| Mean | ${wordCounts.mean} |
| Median | ${wordCounts.median} |
| Std Dev | ${wordCounts.stdDev} |

${wordCounts.stdDev < 50 ? "⚠️ **Low variance** — readings are suspiciously uniform in length." : "Healthy variance in reading length."}

### Opening Patterns

How do readings begin? Grouped by first 3 words:

| Opening | Count | % |
|---------|-------|---|
`;

  for (const [opening, count] of topOpenings) {
    const pct = ((count / totalReadings) * 100).toFixed(0);
    md += `| "${opening}..." | ${count} | ${pct}% |\n`;
  }

  if (topOpenings[0] && topOpenings[0][1] > totalReadings * 0.3) {
    md += `\n⚠️ **Structural repetition detected.** "${topOpenings[0][0]}..." opens ${topOpenings[0][1]} of ${totalReadings} readings.\n`;
  }

  md += `
### Axiom Pair Co-occurrence

These axiom pairs appear together most often:

| Pair | Co-occurrences |
|------|----------------|
`;

  for (const [pair, count] of topPairs) {
    md += `| ${pair} | ${count} |\n`;
  }

  md += `
---

## Cross-Reading Similarity

Phrases (5+ words) appearing in 4+ distinct readings — signals of formulaic output:

`;

  if (repeatedPhrases.length === 0) {
    md += "*No repeated phrases found above threshold. Good diversity.*\n";
  } else {
    md += `| Phrase | Readings | % |\n|-------|----------|---|\n`;
    for (const { phrase, count, pct } of repeatedPhrases) {
      md += `| "${phrase}" | ${count} | ${pct}% |\n`;
    }
  }

  md += `
---

## Category Clustering

Do repos in the same domain get the same axioms?

`;

  for (const [cat, stats] of Object.entries(categoryStats)) {
    md += `### ${cat.charAt(0).toUpperCase() + cat.slice(1)} (${stats.count} repos)\n\n`;
    md += `Unique axioms used: ${stats.uniqueCount}\n\n`;
    if (stats.topAxioms.length) {
      md += `| Most Common | Count |\n|-------------|-------|\n`;
      for (const [ax, count] of stats.topAxioms) {
        md += `| ${ax} | ${count} |\n`;
      }
    }
    md += "\n";
  }

  // Cross-category overlap
  const catAxiomSets = {};
  for (const [cat, stats] of Object.entries(categoryStats)) {
    catAxiomSets[cat] = new Set(stats.topAxioms.map(([ax]) => ax));
  }
  const catNames = Object.keys(catAxiomSets);
  md += `### Cross-Category Top-Axiom Overlap\n\n`;
  md += `| Category A | Category B | Shared Top Axioms |\n|------------|------------|-------------------|\n`;
  for (let i = 0; i < catNames.length; i++) {
    for (let j = i + 1; j < catNames.length; j++) {
      const shared = [...catAxiomSets[catNames[i]]].filter((ax) =>
        catAxiomSets[catNames[j]].has(ax),
      );
      if (shared.length > 0) {
        md += `| ${catNames[i]} | ${catNames[j]} | ${shared.join(", ")} |\n`;
      }
    }
  }

  md += `## Diagnostic Lens Coverage\n\n`;
  md += `How often does each diagnostic lens appear across ${totalReadings} readings?\n\n`;
  md += `| Lens | Readings | % |\n|------|----------|---|\n`;
  for (const [lens, count] of Object.entries(diagnosticLensCounts)) {
    const pct = ((count / totalReadings) * 100).toFixed(0);
    md += `| ${lens} | ${count} | ${pct}% |\n`;
  }
  md += `\n`;

  md += `
---

## Actionable Findings

`;

  // Auto-generate findings
  const findings = [];

  if (coverage.used < coverage.total * 0.5) {
    findings.push(
      `**Over half the axioms are unused.** Only ${coverage.pct}% of available axioms appear. The system prompt tells the model to "use the full range" but it's ignoring ${unused.length} axioms entirely.`,
    );
  }

  if (top10[0] && top10[0][1] > totalReadings * 0.4) {
    findings.push(
      `**Axiom ${top10[0][0]} dominates** — cited in ${((top10[0][1] / totalReadings) * 100).toFixed(0)}% of readings. Consider explicitly deprioritizing it in the prompt.`,
    );
  }

  if (repeatedPhrases.length > 10) {
    findings.push(
      `**${repeatedPhrases.length} formulaic phrases detected.** The model is reusing exact phrasing across readings. Consider adding "never repeat phrasing from previous readings" or randomizing prompt elements.`,
    );
  }

  const highOverlapPairs = [];
  for (let i = 0; i < catNames.length; i++) {
    for (let j = i + 1; j < catNames.length; j++) {
      const shared = [...catAxiomSets[catNames[i]]].filter((ax) =>
        catAxiomSets[catNames[j]].has(ax),
      );
      if (
        shared.length >=
        Math.min(catAxiomSets[catNames[i]].size, catAxiomSets[catNames[j]].size) * 0.6
      ) {
        highOverlapPairs.push(`${catNames[i]}/${catNames[j]}`);
      }
    }
  }
  if (highOverlapPairs.length > 0) {
    findings.push(
      `**High axiom overlap between categories:** ${highOverlapPairs.join(", ")}. Different domains are getting the same readings.`,
    );
  }

  if (wordCounts.stdDev < 50) {
    findings.push(
      `**Uniform reading length** (std dev: ${wordCounts.stdDev}). Readings should vary — a tiny weekend project and a massive framework shouldn't get the same-length oracle response.`,
    );
  }

  if (findings.length === 0) {
    md += "No major issues detected. Readings show healthy diversity.\n";
  } else {
    for (let i = 0; i < findings.length; i++) {
      md += `${i + 1}. ${findings[i]}\n\n`;
    }
  }

  md += `---

## Individual Readings

<details>
<summary>Click to expand all ${totalReadings} readings</summary>

`;

  for (const r of readings) {
    const axioms = extractAxioms(r.text);
    md += `### ${r.owner}/${r.repo} [${r.category}] [${r.lang}]\n`;
    md += `**Axioms cited:** ${axioms.join(", ") || "none detected"}\n`;
    md += `**Word count:** ${r.text.split(/\s+/).filter(Boolean).length}\n\n`;
    md += `${r.text}\n\n---\n\n`;
  }

  md += `</details>\n`;

  return md;
}

// ─── Main ──────────────────────────────────────────────────────────

async function main() {
  await mkdir(RESULTS_DIR, { recursive: true });

  // Load existing results for resume support
  let results = [];
  if (existsSync(READINGS_FILE)) {
    try {
      results = JSON.parse(await readFile(READINGS_FILE, "utf-8"));
      console.log(`Resuming: ${results.length} existing readings found`);
    } catch {
      results = [];
    }
  }

  const done = new Set(results.map((r) => `${r.owner}/${r.repo}`));
  const remaining = REPOS.filter((r) => !done.has(`${r.owner}/${r.repo}`));

  console.log(
    `\n── Repomancer Reading Diversity Test ──\n` +
      `Total repos: ${REPOS.length}\n` +
      `Already done: ${done.size}\n` +
      `Remaining: ${remaining.length}\n`,
  );

  for (let i = 0; i < remaining.length; i++) {
    const { owner, repo, category, lang } = remaining[i];
    const label = `${owner}/${repo}`;
    const progress = `[${done.size + i + 1}/${REPOS.length}]`;

    process.stdout.write(`${progress} ${label}...`);

    try {
      const result = await runReading(owner, repo);
      if (!result) {
        console.log(" SKIP (no context)");
        continue;
      }

      const { diagnostic, reading: text } = result;
      const axioms = extractAxioms(text);
      const wordCount = text.split(/\s+/).filter(Boolean).length;

      results.push({ owner, repo, category, lang, text, diagnostic, axioms, wordCount });

      // Incremental save
      await writeFile(READINGS_FILE, JSON.stringify(results, null, 2));

      console.log(
        ` ✓ ${wordCount} words, axioms: ${axioms.join(", ") || "none"}`,
      );
    } catch (err) {
      console.log(` ERROR: ${err.message}`);
    }

    // Rate limit
    if (i < remaining.length - 1) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  console.log(`\n── Analyzing ${results.length} readings ──\n`);

  const analysis = analyze(results);
  const report = generateReport(analysis, results);

  await writeFile(ANALYSIS_FILE, report);

  // Console summary
  console.log(`Coverage: ${analysis.coverage.used}/${analysis.coverage.total} axioms (${analysis.coverage.pct}%)`);
  console.log(`Top 3: ${analysis.top10.slice(0, 3).map(([ax, c]) => `${ax}(${c})`).join(", ")}`);
  console.log(`Blind spots: ${analysis.unused.length} axioms never used`);
  console.log(`Repeated phrases: ${analysis.repeatedPhrases.length}`);
  console.log(`\nResults: ${READINGS_FILE}`);
  console.log(`Report:  ${ANALYSIS_FILE}`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
