-- Migration: COP Core v0.1 - Idempotency & checkpoints
-- Adds source_event_id to jobs and unique constraints for deduplication
-- Date: 2025-12-06

ALTER TABLE public.cop_job
  ADD COLUMN IF NOT EXISTS source_event_id uuid DEFAULT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_cop_job_topic_type_source_event ON public.cop_job(topic_id, type, source_event_id) WHERE (source_event_id IS NOT NULL);

-- Ensure each job has unique step names to support idempotent step upserts
CREATE UNIQUE INDEX IF NOT EXISTS ux_cop_step_jobid_name ON public.cop_step(job_id, name);

-- Deduplicate artifacts created by the same job/step/type
CREATE UNIQUE INDEX IF NOT EXISTS ux_cop_artifact_job_step_type ON public.cop_artifact(source_job_id, source_step_id, type) WHERE (source_job_id IS NOT NULL AND source_step_id IS NOT NULL);

-- Add a checkpoint field to steps to allow incrementally resumed processing
ALTER TABLE public.cop_step
  ADD COLUMN IF NOT EXISTS checkpoint jsonb DEFAULT '{}'::jsonb;

-- Add a `status_reason` for jobs for better observability
ALTER TABLE public.cop_job
  ADD COLUMN IF NOT EXISTS status_reason text DEFAULT NULL;

COMMENT ON INDEX ux_cop_job_topic_type_source_event IS 'Unique job per event (topic,type,source_event) to support idempotent job creation';
COMMENT ON INDEX ux_cop_step_jobid_name IS 'Unique step name per job to support idempotent step upserts';
COMMENT ON INDEX ux_cop_artifact_job_step_type IS 'Unique artifact identity per job/step/type to avoid duplicates';
