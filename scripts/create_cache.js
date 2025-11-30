#!/usr/bin/env node

/**
 * Create Gemini Context Cache from Supabase Documents
 * Fetches all active documents from Supabase Storage and creates a Gemini cache
 */

import { GoogleAIFileManager, GoogleAICacheManager } from "@google/generative-ai/server";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import fetch from "node-fetch";
import path from "path";
import fs from "fs/promises";
import os from "os";

// Load env vars
config();

const API_KEY = process.env.GOOGLE_FILESEARCH_API_KEY || process.env.GEMINI_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "public-documents";

if (!API_KEY || !SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌ Error: Missing required environment variables");
  console.error("   Required: GEMINI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

console.log("Using Gemini API Key:", API_KEY.substring(0, 10) + "...");

const fileManager = new GoogleAIFileManager(API_KEY);
const cacheManager = new GoogleAICacheManager(API_KEY);
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

/**
 * Fetch all active documents from Supabase
 */
async function fetchActiveDocuments() {
  console.log("\n📂 Fetching active documents from Supabase...");

  const { data, error } = await supabase
    .from("document_sources")
    .select("*")
    .eq("status", "active")
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch documents: ${error.message}`);
  }

  console.log(`   Found ${data.length} active documents`);
  return data;
}

/**
 * Download a file from URL to temporary directory
 */
async function downloadFile(publicUrl, filename) {
  const tempDir = path.join(os.tmpdir(), "gemini-cache");
  await fs.mkdir(tempDir, { recursive: true });

  const tempPath = path.join(tempDir, filename);

  const response = await fetch(publicUrl);
  if (!response.ok) {
    throw new Error(`Failed to download ${filename}: ${response.statusText}`);
  }

  const buffer = await response.arrayBuffer();
  await fs.writeFile(tempPath, Buffer.from(buffer));

  return tempPath;
}

/**
 * Upload file to Gemini File API and wait for processing
 */
async function uploadToGemini(localPath, displayName, mimeType) {
  console.log(`   ⬆️  Uploading ${displayName}...`);

  const uploadResult = await fileManager.uploadFile(localPath, {
    mimeType: mimeType || "application/pdf",
    displayName: displayName,
  });

  console.log(`      Uploaded: ${uploadResult.file.name}`);

  // Wait for Google to process the file
  let file = await fileManager.getFile(uploadResult.file.name);
  let attempts = 0;
  const maxAttempts = 30;

  while (file.state === "PROCESSING" && attempts < maxAttempts) {
    process.stdout.write(".");
    await new Promise((resolve) => setTimeout(resolve, 2000));
    file = await fileManager.getFile(uploadResult.file.name);
    attempts++;
  }

  if (file.state !== "ACTIVE") {
    throw new Error(`File processing failed: ${file.state}`);
  }

  console.log(`\n      ✅ Ready: ${file.state}`);
  return file;
}

/**
 * Create Gemini Context Cache
 */
async function createCache() {
  try {
    // 1. Fetch all active documents
    const documents = await fetchActiveDocuments();

    if (documents.length === 0) {
      console.log("\n⚠️  No documents found. Please upload some documents first:");
      console.log("   node scripts/ingest_documents.js --dir ./your-documents");
      process.exit(0);
    }

    // 2. Download and upload each document
    console.log("\n📤 Uploading documents to Gemini...");
    const uploadedFiles = [];

    for (const doc of documents) {
      try {
        const tempPath = await downloadFile(doc.public_url, doc.filename);
        const geminiFile = await uploadToGemini(tempPath, doc.filename, doc.mime_type);

        uploadedFiles.push({
          uri: geminiFile.uri,
          mimeType: geminiFile.mimeType,
          displayName: doc.filename,
        });

        // Clean up temp file
        await fs.unlink(tempPath);
      } catch (error) {
        console.error(`   ⚠️  Failed to upload ${doc.filename}:`, error.message);
        // Continue with other files
      }
    }

    if (uploadedFiles.length === 0) {
      console.error("\n❌ No files were successfully uploaded to Gemini");
      process.exit(1);
    }

    console.log(`\n✅ Successfully uploaded ${uploadedFiles.length}/${documents.length} documents`);

    // 3. Create Context Cache
    console.log("\n🔨 Creating Gemini Context Cache...");

    // Prepare contents array with all files
    const contents = uploadedFiles.map((file) => ({
      role: "user",
      parts: [
        {
          fileData: {
            mimeType: file.mimeType,
            fileUri: file.uri,
          },
        },
      ],
    }));

    // Note: TTL should be at least 5 minutes (300s)
    // For production, use longer TTL (e.g., 24 hours = 86400s)
    const cache = await cacheManager.create({
      model: "models/gemini-2.5-flash",
      displayName: "pertitellu",
      ttlSeconds: 3600, // 1 hour (adjust as needed)
      contents: contents,
    });

    console.log(`\n✅ Context Cache created successfully!`);
    console.log(`   Cache ID     : ${cache.name}`);
    console.log(`   Display Name : ${cache.displayName}`);
    console.log(`   Model        : ${cache.model}`);
    console.log(`   Documents    : ${uploadedFiles.length}`);
    console.log(
      `   Expires in   : ${cache.ttlSeconds} seconds (${Math.round(cache.ttlSeconds / 3600)} hours)`
    );

    console.log("\n📋 IMPORTANT: Update your .env file with:");
    console.log(`GEMINI_CACHE_ID=${cache.name}`);

    console.log("\n🔄 Then restart your development server to use the new cache.");
  } catch (error) {
    console.error("\n❌ Error creating cache:", error.message);
    if (error.message.includes("quota") || error.message.includes("limit")) {
      console.error("\n💡 Tip: This might be a quota issue. Check:");
      console.error(
        "   - https://console.cloud.google.com/apis/api/generativeai.googleapis.com/quotas"
      );
      console.error("   - Wait a few hours and try again");
    }
    process.exit(1);
  }
}

console.log(`
╭─────────────────────────────────────────────────────╮
│  Gemini Context Cache Builder                      │
│  For Ophélia Document Search                       │
╰─────────────────────────────────────────────────────╯
`);

createCache();
