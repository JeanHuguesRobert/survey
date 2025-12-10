-- NOUVELLE TABLE : public.cop_steps
create table public.cop_steps (
  id uuid primary key default gen_random_uuid(),

  job_id uuid not null references public.cop_jobs(id) on delete cascade,

  name text not null,                  -- ex: 'RUN_PROLOG', 'LOAD_FACTS', 'CALL_LLM'
  index_in_job integer not null default 0,  -- ordre relatif, optionnel mais très utile

  status text not null default 'running',   -- 'running', 'completed', 'failed'
  input_hash text,                          -- hachage des données d'entrée de cette étape
  last_error text,                          -- message d'erreur de cette étape (si failed)

  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists idx_cop_steps_job
  on public.cop_steps (job_id);

create index if not exists idx_cop_steps_status
  on public.cop_steps (status);
