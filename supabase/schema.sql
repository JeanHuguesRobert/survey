-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.chat_interactions (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  user_id uuid,
  question text NOT NULL,
  answer text,
  sources jsonb,
  metadata jsonb DEFAULT '{}'::jsonb,
  feedback text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT chat_interactions_pkey PRIMARY KEY (id),
  CONSTRAINT chat_interactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.chatbot_settings (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  welcome_message text DEFAULT 'Bonjour ! Comment puis-je vous aider concernant la vie locale à Corte ?'::text,
  fallback_message text DEFAULT 'Désolé, je ne trouve pas de réponse. Souhaitez-vous créer une proposition ?'::text,
  similarity_threshold double precision DEFAULT 0.65,
  max_sources integer DEFAULT 3,
  enable_proposition_creation boolean DEFAULT true,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  metadata jsonb DEFAULT '{"schemaVersion": 1}'::jsonb,
  CONSTRAINT chatbot_settings_pkey PRIMARY KEY (id)
);
CREATE TABLE public.collected_data (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  source_url text NOT NULL,
  data_type text NOT NULL CHECK (data_type = ANY (ARRAY['Titre'::text, 'Description'::text, 'Date'::text, 'Lieu'::text, 'Personne'::text, 'Organisation'::text, 'Autre'::text])),
  value text NOT NULL,
  status text NOT NULL DEFAULT 'draft'::text CHECK (status = ANY (ARRAY['draft'::text, 'reviewed'::text, 'published'::text, 'archived'::text])),
  metadata jsonb DEFAULT '{"schemaVersion": 1}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT collected_data_pkey PRIMARY KEY (id),
  CONSTRAINT collected_data_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.comments (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  post_id uuid NOT NULL,
  user_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{"schemaVersion": 1}'::jsonb,
  CONSTRAINT comments_pkey PRIMARY KEY (id),
  CONSTRAINT comments_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.posts(id),
  CONSTRAINT comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.content_subscriptions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  content_type text NOT NULL CHECK (content_type = ANY (ARRAY['post'::text, 'proposition'::text, 'wiki_page'::text])),
  content_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT content_subscriptions_pkey PRIMARY KEY (id),
  CONSTRAINT content_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.cortideri_items (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  post_id bigint UNIQUE,
  category_id integer,
  url text,
  list_title text,
  title text,
  content_text text,
  image_url text,
  content_html text,
  comment_count integer,
  tags ARRAY,
  image_urls ARRAY,
  scraped_at timestamp with time zone DEFAULT now(),
  source_id uuid,
  synced_at timestamp with time zone,
  CONSTRAINT cortideri_items_pkey PRIMARY KEY (id)
);
CREATE TABLE public.delegations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  delegator_id uuid NOT NULL,
  delegate_id uuid NOT NULL,
  tag_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{"schemaVersion": 1}'::jsonb,
  CONSTRAINT delegations_pkey PRIMARY KEY (id),
  CONSTRAINT delegations_delegator_id_fkey FOREIGN KEY (delegator_id) REFERENCES public.users(id),
  CONSTRAINT delegations_delegate_id_fkey FOREIGN KEY (delegate_id) REFERENCES public.users(id),
  CONSTRAINT delegations_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES public.tags(id)
);
CREATE TABLE public.document_sources (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  filename text NOT NULL,
  content_hash text NOT NULL UNIQUE,
  public_url text NOT NULL,
  file_size_bytes bigint,
  mime_type text,
  metadata jsonb DEFAULT '{}'::jsonb,
  first_ingested_at timestamp with time zone DEFAULT now(),
  last_ingested_at timestamp with time zone DEFAULT now(),
  ingestion_method text CHECK (ingestion_method = ANY (ARRAY['ui_upload'::text, 'cli_bulk'::text, 'cache_rebuild'::text])),
  status text DEFAULT 'active'::text CHECK (status = ANY (ARRAY['active'::text, 'archived'::text, 'deleted'::text])),
  ingested_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  domain text,
  source_type text,
  external_id text,
  CONSTRAINT document_sources_pkey PRIMARY KEY (id),
  CONSTRAINT document_sources_ingested_by_fkey FOREIGN KEY (ingested_by) REFERENCES auth.users(id)
);
CREATE TABLE public.git_sync_log (
  page_id uuid NOT NULL,
  last_sync_date date NOT NULL,
  commit_sha text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT git_sync_log_pkey PRIMARY KEY (page_id, last_sync_date),
  CONSTRAINT git_sync_log_page_id_fkey FOREIGN KEY (page_id) REFERENCES public.wiki_pages(id)
);
CREATE TABLE public.group_members (
  group_id uuid NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb,
  CONSTRAINT group_members_pkey PRIMARY KEY (group_id, user_id),
  CONSTRAINT group_members_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id),
  CONSTRAINT group_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.groups (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  description text,
  created_by uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{"schemaVersion": 1}'::jsonb,
  CONSTRAINT groups_pkey PRIMARY KEY (id),
  CONSTRAINT groups_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id)
);
CREATE TABLE public.jobs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  owner uuid,
  type text NOT NULL,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'running'::text, 'completed'::text, 'failed'::text, 'cancelled'::text])),
  progress integer NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  message text,
  payload jsonb DEFAULT '{}'::jsonb,
  result jsonb,
  error_details jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  CONSTRAINT jobs_pkey PRIMARY KEY (id),
  CONSTRAINT jobs_owner_fkey FOREIGN KEY (owner) REFERENCES auth.users(id)
);
CREATE TABLE public.knowledge_chunks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  source_id uuid,
  text text NOT NULL,
  text_hash text NOT NULL,
  embedding USER-DEFINED,
  type text NOT NULL CHECK (type = ANY (ARRAY['fact'::text, 'allegation'::text, 'opinion'::text])),
  status text NOT NULL DEFAULT 'under_review'::text CHECK (status = ANY (ARRAY['under_review'::text, 'confirmed'::text, 'refuted'::text, 'obsolete'::text])),
  source_type text NOT NULL,
  domain text NOT NULL,
  territory text NOT NULL DEFAULT 'Corte'::text,
  info_date date,
  layer text NOT NULL DEFAULT 'hot'::text CHECK (layer = ANY (ARRAY['hot'::text, 'summary'::text, 'archive'::text])),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT knowledge_chunks_pkey PRIMARY KEY (id),
  CONSTRAINT knowledge_chunks_source_id_fkey FOREIGN KEY (source_id) REFERENCES public.document_sources(id)
);
CREATE TABLE public.municipal_transparency (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  commune_name text NOT NULL,
  insee_code text,
  population integer CHECK (population >= 0),
  agenda_mentions_location boolean NOT NULL DEFAULT false,
  livestreamed boolean NOT NULL DEFAULT false,
  minutes_published_under_week boolean NOT NULL DEFAULT false,
  deliberations_open_data boolean NOT NULL DEFAULT false,
  annual_calendar_published boolean NOT NULL DEFAULT false,
  public_can_speak boolean NOT NULL DEFAULT false,
  contact_email text,
  submitted_by text,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT municipal_transparency_pkey PRIMARY KEY (id)
);
CREATE TABLE public.posts (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{"schemaVersion": 1}'::jsonb,
  CONSTRAINT posts_pkey PRIMARY KEY (id),
  CONSTRAINT posts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.proposition_tags (
  proposition_id uuid NOT NULL,
  tag_id uuid NOT NULL,
  CONSTRAINT proposition_tags_pkey PRIMARY KEY (proposition_id, tag_id),
  CONSTRAINT proposition_tags_proposition_id_fkey FOREIGN KEY (proposition_id) REFERENCES public.propositions(id),
  CONSTRAINT proposition_tags_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES public.tags(id)
);
CREATE TABLE public.propositions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL,
  author_id uuid,
  status text DEFAULT 'active'::text CHECK (status = ANY (ARRAY['active'::text, 'closed'::text, 'draft'::text])),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{"schemaVersion": 1}'::jsonb,
  CONSTRAINT propositions_pkey PRIMARY KEY (id),
  CONSTRAINT propositions_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.users(id)
);
CREATE TABLE public.reactions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  target_type text NOT NULL,
  target_id uuid NOT NULL,
  emoji text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT reactions_pkey PRIMARY KEY (id),
  CONSTRAINT reactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.tags (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text DEFAULT ''::text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{"schemaVersion": 1}'::jsonb,
  CONSTRAINT tags_pkey PRIMARY KEY (id)
);
CREATE TABLE public.users (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  display_name text NOT NULL DEFAULT ''::text,
  created_at timestamp with time zone DEFAULT now(),
  neighborhood text,
  interests text,
  rgpd_consent_accepted boolean DEFAULT false,
  rgpd_consent_date timestamp with time zone,
  updated_at timestamp with time zone DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{"schemaVersion": 1}'::jsonb,
  CONSTRAINT users_pkey PRIMARY KEY (id)
);
CREATE TABLE public.votes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  proposition_id uuid NOT NULL,
  vote_value boolean,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb,
  CONSTRAINT votes_pkey PRIMARY KEY (id),
  CONSTRAINT votes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT votes_proposition_id_fkey FOREIGN KEY (proposition_id) REFERENCES public.propositions(id)
);
CREATE TABLE public.wiki_pages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  content text NOT NULL,
  author_id uuid,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  summary text,
  metadata jsonb NOT NULL DEFAULT '{"schemaVersion": 1}'::jsonb,
  CONSTRAINT wiki_pages_pkey PRIMARY KEY (id),
  CONSTRAINT wiki_pages_author_id_fkey FOREIGN KEY (author_id) REFERENCES auth.users(id)
);

