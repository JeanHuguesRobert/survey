-- NOUVELLE TABLE : public.cop_jobs
create table public.cop_jobs (
  id uuid primary key default gen_random_uuid(),

  -- Métadonnées de la tâche
  job_type text not null,             -- ex: 'AUDIT_LEGAL_STATE', 'RAG_INDEXING'
  worker_agent_name text not null,    -- ex: 'AuditorAgent', 'Ophélia'

  -- Lien avec COP (corrélation globale)
  root_correlation_id uuid,          -- corrélation "racine" de ce job (optionnel)
  channel text,                      -- COP channel éventuel

  -- Incrémentalité / idempotence
  source_entity_id uuid,             -- entité métier ciblée (acte, demande, document…)
  source_entity_type text,           -- ex: 'acte', 'demande_admin'
  idempotency_hash text,             -- hachage de l'état des données sources

  -- Gestion OTP / queue
  status text not null default 'pending',   -- 'pending', 'running', 'completed', 'failed', 'cancelled'
  retry_count integer not null default 0,
  priority integer not null default 0,      -- 0 = normal, >0 haute priorité

  last_error text,                          -- message d'erreur dernière tentative (optionnel)

  -- Timestamps
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz
);

create index if not exists idx_cop_jobs_status_type
  on public.cop_jobs (status, job_type);

create index if not exists idx_cop_jobs_entity
  on public.cop_jobs (source_entity_id);

create index if not exists idx_cop_jobs_root_corr
  on public.cop_jobs (root_correlation_id);
