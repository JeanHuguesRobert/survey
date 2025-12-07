import express from "express";
import * as db from "./db.js";

const router = express.Router();

router.get("/health", (req, res) => {
  res.json({ ok: true, service: "cop", version: "0.1" });
});

router.get("/conversations", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit || "50");
    const offset = parseInt(req.query.offset || "0");
    const rows = await db.listConversations({ limit, offset });
    res.json({ data: rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/conversations", async (req, res) => {
  try {
    const { title, description, created_by = null, metadata = {} } = req.body;
    const conv = await db.createConversation({ title, description, created_by, metadata });
    res.status(201).json(conv);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Participants
router.post("/conversations/:id/participants", async (req, res) => {
  try {
    const { user_id = null, role = "participant", metadata = {} } = req.body;
    const participant = await db.createParticipant({
      conversation_id: req.params.id,
      user_id,
      role,
      metadata,
    });
    res.status(201).json(participant);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/conversations/:id", async (req, res) => {
  try {
    const conv = await db.getConversation(req.params.id);
    if (!conv) return res.status(404).json({ error: "Conversation not found" });
    res.json(conv);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/conversations/:id/messages", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit || "100");
    const offset = parseInt(req.query.offset || "0");
    const rows = await db.listMessages(req.params.id, { limit, offset });
    res.json({ data: rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/conversations/:id/messages", async (req, res) => {
  try {
    const { participant_id = null, content, content_type = "text", metadata } = req.body;
    if (!content) return res.status(400).json({ error: "content is required" });
    const message = await db.createMessage({
      conversation_id: req.params.id,
      participant_id,
      content,
      content_type,
      metadata,
    });
    // Also create a COP event for message publication
    try {
      await db.createEvent({
        topic_id: req.params.id,
        type: "user_message",
        payload: { content, participant_id },
        meta: metadata,
      });
    } catch (e) {
      console.warn("Failed to create COP event for message", e.message);
    }
    res.status(201).json(message);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/conversations/:id/events", async (req, res) => {
  try {
    const { type, payload = {}, meta = {}, created_by = null } = req.body;
    const ev = await db.createEvent({ topic_id: req.params.id, type, payload, meta, created_by });
    res.status(201).json(ev);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
