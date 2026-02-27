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
