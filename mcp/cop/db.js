import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_SERVICE_KEY;

let supabase = null;
function client() {
  if (!supabase) {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      throw new Error("SUPABASE_URL and SUPABASE_SERVICE_KEY env variables required");
    }
    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  }
  return supabase;
}

export async function createConversation({
  title,
  description,
  created_by = null,
  metadata = {},
} = {}) {
  // Insert into cop_topic (new canonical table). Keep handler name for backwards compat.
  const payload = { title, metadata: { ...(metadata || {}), description } };
  const { data, error } = await client().from("cop_topic").insert([payload]).select().single();
  if (error) throw error;
  return data;
}

export async function getConversation(id) {
  // Read from cop_topic
  const { data, error } = await client().from("cop_topic").select().eq("id", id).single();
  if (error) throw error;
  return data;
}

export async function listConversations({ limit = 50, offset = 0 } = {}) {
  // List cop_topic rows, preserving function signature for compatibility
  const { data, error } = await client()
    .from("cop_topic")
    .select()
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throw error;
  return data;
}

export async function createParticipant({
  conversation_id,
  user_id = null,
  role = "participant",
  metadata = {},
} = {}) {
  // Participants table uses topic_id
  const { data, error } = await client()
    .from("cop_participants")
    .insert([{ topic_id: conversation_id, user_id, role, metadata }])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function createMessage({
  conversation_id,
  participant_id = null,
  content,
  content_type = "text",
  metadata = {},
} = {}) {
  // Older API used cop_messages; modern COP design uses cop_event with type 'user_message'.
  // Insert an event row and return a message-like object for compatibility.
  const { data: ev, error: evErr } = await client()
    .from("cop_event")
    .insert([
      {
        topic_id: conversation_id,
        type: "user_message",
        payload: { content, participant_id, content_type },
        meta: metadata,
      },
    ])
    .select()
    .single();
  if (evErr) throw evErr;
  // Map event to a compatible message object
  const msg = {
    id: ev.id,
    topic_id: ev.topic_id,
    participant_id,
    content,
    content_type,
    metadata,
    created_at: ev.created_at,
  };
  return msg;
}

export async function createEvent({
  topic_id,
  type,
  payload = {},
  meta = {},
  created_by = null,
} = {}) {
  const { data, error } = await client()
    .from("cop_event")
    .insert([{ topic_id, type, payload, meta, created_by }])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function listMessages(conversation_id, { limit = 100, offset = 0 } = {}) {
  // Return COP events of type user_message, mapped to message-like objects for compatibility
  const { data, error } = await client()
    .from("cop_event")
    .select("*")
    .eq("topic_id", conversation_id)
    .eq("type", "user_message")
    .order("created_at", { ascending: true })
    .range(offset, offset + limit - 1);
  if (error) throw error;
  // Map events to message-like objects
  return data.map((ev) => ({
    id: ev.id,
    topic_id: ev.topic_id,
    participant_id: ev.payload?.participant_id || null,
    content: ev.payload?.content || null,
    content_type: ev.payload?.content_type || "text",
    metadata: ev.meta || {},
    created_at: ev.created_at,
  }));
}

export default {
  createConversation,
  getConversation,
  listConversations,
  createParticipant,
  createMessage,
  listMessages,
};
