import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import crypto from "crypto";

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function hashText(text) {
  return crypto.createHash("sha256").update(text.toLowerCase().trim()).digest("hex");
}

async function generateEmbedding(text) {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });
  return response.data[0].embedding;
}

export default async (req, context) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const {
      sourceId, // Optional: if updating existing source
      title,
      type,
      url,
      summary,
      chunks, // Array of strings
      questions, // Array of strings
      tags,
      domain,
      ingestedBy, // User ID
    } = await req.json();

    // 1. Upsert Document Source
    const contentHash = hashText(JSON.stringify({ summary, chunks, questions })); // Simple hash of the curated content

    const sourceData = {
      external_id: url || `manual:${Date.now()}`, // Fallback ID
      filename: title,
      content_hash: contentHash,
      public_url: url,
      source_type: type,
      domain: domain,
      ingested_by: ingestedBy,
      metadata: {
        title,
        summary,
        questions,
        tags,
        curated: true,
      },
      status: "active",
      ingestion_method: "ui_curator",
    };

    let source_id = sourceId;

    if (!source_id) {
      // Check if exists by external_id to avoid duplicates if possible, though manual ingestion might want to overwrite
      const { data: existing } = await supabase
        .from("document_sources")
        .select("id")
        .eq("external_id", sourceData.external_id)
        .maybeSingle();

      if (existing) {
        source_id = existing.id;
        await supabase.from("document_sources").update(sourceData).eq("id", source_id);
      } else {
        const { data: newSource, error: sourceError } = await supabase
          .from("document_sources")
          .insert(sourceData)
          .select("id")
          .single();

        if (sourceError) throw sourceError;
        source_id = newSource.id;
      }
    } else {
      await supabase.from("document_sources").update(sourceData).eq("id", source_id);
    }

    // 2. Process Chunks
    // First, archive old chunks for this source if we are doing a full re-ingestion
    // For now, we'll just insert new ones. A more advanced logic would be to diff them.
    // Let's delete old confirmed chunks for this source to keep it clean for this V1.
    await supabase.from("knowledge_chunks").delete().eq("source_id", source_id);

    const chunkInserts = [];

    // Process Fact Chunks
    for (const chunkText of chunks) {
      const embedding = await generateEmbedding(chunkText);
      chunkInserts.push({
        source_id: source_id,
        text: chunkText,
        text_hash: hashText(chunkText),
        embedding: JSON.stringify(embedding),
        type: "fact",
        status: "confirmed", // User reviewed it
        source_type: type,
        domain: domain,
        layer: "hot",
        metadata: {
          tags,
          questions, // Associate questions with every chunk for now, or we could create specific Q&A chunks
        },
      });
    }

    // Process Questions as "Question" chunks?
    // Or just rely on the fact chunks being retrieved?
    // NotebookLM style: The questions are often used to generate "QA" pairs.
    // For now, let's stick to ingesting the facts. The questions in metadata help context.
    // OPTION: We could ingest the questions as "hidden" chunks or just part of the metadata.
    // Let's add the Summary as a "summary" chunk.
    if (summary) {
      const summaryEmbedding = await generateEmbedding(summary);
      chunkInserts.push({
        source_id: source_id,
        text: summary,
        text_hash: hashText(summary),
        embedding: JSON.stringify(summaryEmbedding),
        type: "fact", // or 'summary' if supported
        status: "confirmed",
        source_type: type,
        domain: domain,
        layer: "summary",
        metadata: { tags, is_summary: true },
      });
    }

    if (chunkInserts.length > 0) {
      const { error: chunkError } = await supabase.from("knowledge_chunks").insert(chunkInserts);
      if (chunkError) throw chunkError;
    }

    return new Response(JSON.stringify({ success: true, sourceId: source_id }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in ingest-content:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
