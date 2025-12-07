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
  const { data, error } = await client()
    .from("cop_conversations")
    .insert([{ title, description, created_by, metadata }])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getConversation(id) {
  const { data, error } = await client().from("cop_conversations").select().eq("id", id).single();
  if (error) throw error;
  return data;
}

export async function listConversations({ limit = 50, offset = 0 } = {}) {
  const { data, error } = await client()
    .from("cop_conversations")
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
  const { data, error } = await client()
    .from("cop_participants")
    .insert([{ conversation_id, user_id, role, metadata }])
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
  const { data, error } = await client()
    .from("cop_messages")
    .insert([{ conversation_id, participant_id, content, content_type, metadata }])
    .select()
    .single();
  if (error) throw error;
  return data;
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
  const { data, error } = await client()
    .from("cop_messages")
    .select("*")
    .eq("conversation_id", conversation_id)
    .order("created_at", { ascending: true })
    .range(offset, offset + limit - 1);
  if (error) throw error;
  return data;
}

export default {
  createConversation,
  getConversation,
  listConversations,
  createParticipant,
  createMessage,
  listMessages,
};
