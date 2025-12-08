import fs from "fs";
import path from "path";
import Anthropic from "@anthropic-ai/sdk";
import { loadConfig, getConfigValue } from "./lib/config.js";

// Charger la configuration
await loadConfig();

const INPUT_FILE = path.resolve("public", "docs", "conseils", "conseil-consolidated.optimized.md");
const OUTPUT_FILE = INPUT_FILE.replace(".optimized.md", ".compressed.md");

const anthropic = new Anthropic({ apiKey: getConfigValue("anthropic_api_key") });

// ============================================================================
// Chunking intelligent
// ============================================================================

function chunkBySection(text, maxChars = 4000) {
  const sections = text.split(/^###/m).filter((s) => s.trim());
  const chunks = [];
  let currentChunk = "";

  for (const section of sections) {
    if (currentChunk.length + section.length > maxChars && currentChunk) {
      chunks.push("###" + currentChunk);
      currentChunk = "";
    }
    currentChunk += section;
  }

  if (currentChunk.trim()) {
    chunks.push("###" + currentChunk);
  }

  return chunks;
}

// ============================================================================
// Compression par IA
// ============================================================================

async function compressChunk(chunk, index, total) {
  console.log(`[IA] 🤖 Compression chunk ${index + 1}/${total}...`);

  const prompt = `Tu es un expert en synthèse de comptes-rendus municipaux.

MISSION: Compresse ce texte en GARDANT TOUS les faits importants pour un assistant IA municipal:

✅ À GARDER (100%):
- Délibérations et votes (résultats EXACTS: X-Y-Z)
- Projets et budgets (montants PRÉCIS en €)
- Dates, échéances, deadlines
- Noms d'élus et fonctions
- Décisions actées et oppositions
- Numéros de délibérations

❌ À SUPPRIMER:
- Formules de politesse répétitives
- Détails procéduraux non essentiels
- Répétitions de contexte
- Longues justifications (garder juste la conclusion)

FORMAT: Markdown structuré, listes à puces, tableaux si pertinent.

TEXTE À COMPRESSER:
${chunk}

COMPRESSION (factuelle, aucun oubli de chiffre/vote):`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-3-5-haiku-20241022",
      max_tokens: 3000,
      temperature: 0.1, // Très déterministe
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const compressed = response.content[0].text;
    console.log(
      `[IA] ✅ ${chunk.length} → ${compressed.length} chars (-${((1 - compressed.length / chunk.length) * 100).toFixed(1)}%)`
    );
    return compressed;
  } catch (error) {
    console.error(`[IA] ❌ Erreur compression:`, error.message);
    return chunk; // Fallback: retourner l'original
  }
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  if (!getConfigValue("anthropic_api_key")) {
    console.error("❌ ANTHROPIC_API_KEY manquant");
    process.exit(1);
  }

  if (!fs.existsSync(INPUT_FILE)) {
    console.error(`❌ Fichier introuvable: ${INPUT_FILE}`);
    console.log("💡 Exécutez d'abord: node scripts/optimize-council-content.js");
    process.exit(1);
  }

  console.log("═══════════════════════════════════════════════════════");
  console.log("🤖 Compression IA avec Claude");
  console.log("═══════════════════════════════════════════════════════\n");

  const content = fs.readFileSync(INPUT_FILE, "utf-8");
  console.log(`📊 Fichier d'entrée: ${content.length.toLocaleString()} chars\n`);

  // Chunking
  const chunks = chunkBySection(content);
  console.log(`📦 Découpé en ${chunks.length} chunks\n`);

  // Compression chunk par chunk
  const compressed = [];
  for (let i = 0; i < chunks.length; i++) {
    const result = await compressChunk(chunks[i], i, chunks.length);
    compressed.push(result);

    // Pause pour éviter rate limiting
    if (i < chunks.length - 1) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  const final = compressed.join("\n\n---\n\n");

  // Résumé
  console.log("\n═══════════════════════════════════════════════════════");
  console.log("📊 RÉSUMÉ");
  console.log("═══════════════════════════════════════════════════════");
  console.log(`Avant IA:     ${content.length.toLocaleString()} chars`);
  console.log(`Après IA:     ${final.length.toLocaleString()} chars`);
  console.log(`Réduction IA: ${((1 - final.length / content.length) * 100).toFixed(1)}%\n`);

  fs.writeFileSync(OUTPUT_FILE, final, "utf-8");
  console.log(`✅ Fichier compressé: ${OUTPUT_FILE}\n`);
}

main().catch((err) => {
  console.error("❌ Erreur:", err);
  process.exit(1);
});
