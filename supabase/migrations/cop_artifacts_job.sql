alter table public.cop_artifacts
  add column job_id uuid references public.cop_jobs(id) on delete cascade,
  add column job_step_id uuid references public.cop_steps(id) on delete cascade;
