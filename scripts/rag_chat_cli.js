#!/usr/bin/env node
import dotenv from "dotenv";
dotenv.config();

import { createClient } from "@supabase/supabase-js";

const OPENAI_KEY = process.env.OPENAI_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!OPENAI_KEY) {
  console.error("Missing OPENAI_API_KEY in environment");
  process.exit(1);
}
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small";
const CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || "gpt-3.5-turbo";

async function getEmbedding(text) {
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_KEY}`,
    },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input: text }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error("Embedding error: " + err);
  }
  const j = await res.json();
  return j.data[0].embedding;
}

function dot(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}
function norm(a) {
  return Math.sqrt(dot(a, a));
}
function cosine(a, b) {
  return dot(a, b) / (norm(a) * norm(b));
}

async function fetchChunks(limit = 1000) {
  const { data, error } = await supabase
    .from("knowledge_chunks")
    .select("id,text,embedding,metadata,source_id")
    .limit(limit);
  if (error) throw error;
  return data.map((r) => {
    let emb = r.embedding;
    if (typeof emb === "string") {
      try {
        emb = JSON.parse(emb);
      } catch (e) {
        emb = emb.split(",").map(Number);
      }
    }
    return { ...r, embedding: emb };
  });
}

async function getTopMatches(query, topK = 5, fetchLimit = 1000) {
  const qEmb = await getEmbedding(query);
  const chunks = await fetchChunks(fetchLimit);
  const scored = chunks.map((c) => ({ score: cosine(qEmb, c.embedding), chunk: c }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}

async function callChat(messages) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_KEY}` },
    body: JSON.stringify({ model: CHAT_MODEL, messages, max_tokens: 800 }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error("Chat completion error: " + err);
  }
  const j = await res.json();
  const content = j.choices?.[0]?.message?.content ?? "";
  return { content, raw: j };
}

function buildSystemPrompt(snippets) {
  let intro =
    "You are an assistant that answers using the provided document snippets. Cite sources when possible.";
  if (!snippets || snippets.length === 0) return intro;
  const ctx = snippets.map(
    (s, i) =>
      `---\nSource ${i + 1} (score=${(s.score || 0).toFixed(3)}): ${s.chunk.metadata?.canonical_pdf_path || s.chunk.source_id || "unknown"}\n${s.chunk.text}`
  );
  return intro + "\n\n" + ctx.join("\n\n");
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.log('Usage: node scripts/rag_chat_cli.js "Your question" [--top N] [--json]');
    process.exit(0);
  }

  const jsonOut = args.includes("--json");
  const rawQuery = args[0];
  const topIdx = args.indexOf("--top");
  const topK = topIdx >= 0 && args[topIdx + 1] ? Number(args[topIdx + 1]) : 5;

  const requestId = globalThis.crypto && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`;
  const timestamp = new Date().toISOString();
  const startTime = Date.now();

  console.log("Provider: OpenAI");
  console.log("Embedding model:", EMBEDDING_MODEL);
  console.log("Chat model:", CHAT_MODEL);

  console.log("Embedding query and fetching top", topK, "chunks...");
  const matches = await getTopMatches(rawQuery, topK, 1000);

  const systemPrompt = buildSystemPrompt(matches);
  const userPrompt = `Question: ${rawQuery}\n\nAnswer concisely and list sources (file names or IDs).`;

  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];

  console.log("Calling chat model...");
  const chatResult = await callChat(messages);
  const answer = chatResult.content;
  const rawResp = chatResult.raw || {};

  const durationMs = Date.now() - startTime;

  const matchesMeta = matches.map((m) => ({
    chunk_id: m.chunk.id,
    source_id: m.chunk.source_id || null,
    canonical: m.chunk.meta?.canonical_pdf_path || null,
    score: m.score,
  }));

  if (jsonOut) {
    const out = {
      request_id: requestId,
      timestamp,
      provider: "openai",
      embedding_model: EMBEDDING_MODEL,
      chat_model: CHAT_MODEL,
      top_k: topK,
      duration_ms: durationMs,
      matches: matchesMeta,
      response: {
        text: answer,
        provider_id: rawResp.id || null,
        usage: rawResp.usage || null,
      },
    };
    console.log(JSON.stringify(out, null, 2));
    return;
  }

  console.log("\n=== Answer ===\n");
  console.log(answer);
  console.log("\n=== Matches ===\n");
  matches.forEach((m, i) => {
    console.log(
      `#${i + 1} score=${m.score.toFixed(4)} id=${m.chunk.id} src=${m.chunk.metadata?.canonical_pdf_path || m.chunk.source_id}`
    );
    console.log(
      m.chunk.text.slice(0, 400).replace(/\n+/g, " ") + (m.chunk.text.length > 400 ? "…" : "")
    );
    console.log("---");
  });
  console.log("\n=== Metadata ===\n");
  console.log(`request_id: ${requestId}`);
  console.log(`timestamp: ${timestamp}`);
  console.log(`provider: OpenAI`);
  console.log(`embedding_model: ${EMBEDDING_MODEL}`);
  console.log(`chat_model: ${CHAT_MODEL}`);
  console.log(`duration_ms: ${durationMs}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
