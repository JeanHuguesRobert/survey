# Cortideri Ingestion Script

## What it does

Transforms `cortideri_items` into `knowledge_chunks` with:

1. **Intelligent Chunking**: Splits articles >1500 tokens by paragraphs
2. **Vector Embeddings**: Generates embeddings using OpenAI `text-embedding-3-small` (batched for
   efficiency)
3. **Deduplication**: Uses `text_hash` to avoid duplicate chunks
4. **Document Tracking**: Creates/updates `document_sources` entries
5. **Idempotency**: Re-running the script only processes changed articles

## Prerequisites

- ✅ Migration `001_rag_infrastructure.sql` applied
- ✅ `OPENAI_API_KEY` in `.env`
- ✅ `cortideri_items` table populated (run `npm run scrape:cortideri` first)

## Usage

```bash
node scripts/ingest_cortideri_chunks.js
```

## What happens

For each article in `cortideri_items`:

1. **Check if changed**: Compare `content_hash` in `document_sources`
2. **Skip if unchanged**: Idempotent behavior
3. **Chunk the article**:
   - ≤1500 tokens → 1 chunk
   - \>1500 tokens → Split by paragraphs
4. **Generate embeddings**: OpenAI API call for each chunk
5. **Insert into `knowledge_chunks`**: With deduplication via `text_hash`
6. **Update `synced_at`**: Mark article as processed

## Output example

```
📄 Processing: Mairie de Corte – Conseil Municipal de Toussaint Pierucci
  Source created: cortideri:10657
  📦 Chunks: 3
  🔹 Chunk 1/3: queued for embedding
  🔹 Chunk 2/3: queued for embedding
  🔹 Chunk 3/3: queued for embedding
    Processing 1 embedding batch(es)...
    Batch 1/1: 3 chunks
    Generating embeddings for 3 chunks...
    Inserting 3 chunks...
    Total inserted: 3 chunks
  ✅ Done (3/3 new chunks)
```

## Cost estimation

- **Embeddings**: ~$0.00002 per 1000 tokens
- **454 articles** × ~1000 tokens avg = ~$0.01 total

## Troubleshooting

### Error: "vector type not found"

→ Run migration to enable `pgvector` extension

### Error: "OPENAI_API_KEY not found"

→ Add to `.env` file

### Chunks not appearing

→ Check `knowledge_chunks` table:

```sql
SELECT COUNT(*) FROM knowledge_chunks;
```

## Next steps

After ingestion:

1. Verify chunks: `SELECT * FROM knowledge_chunks LIMIT 10;`
2. Test vector search
3. Update chatbot to use RAG
