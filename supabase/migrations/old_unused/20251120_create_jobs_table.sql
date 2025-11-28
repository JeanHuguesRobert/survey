-- Create jobs table for tracking long-running operations with realtime broadcasts
-- This enables progress monitoring and reliable state persistence

CREATE TABLE IF NOT EXISTS public.jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL, -- e.g., 'data_import', 'report_generation', 'ai_processing'
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  progress integer NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  message text, -- Human-readable status message
  payload jsonb DEFAULT '{}', -- Job-specific data
  result jsonb, -- Job result data
  error_details jsonb, -- Error information if failed
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz
);

-- Enable RLS
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own jobs"
  ON public.jobs FOR SELECT
  TO authenticated
  USING (auth.uid() = owner);

CREATE POLICY "Users can create their own jobs"
  ON public.jobs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = owner);

CREATE POLICY "Users can update their own jobs"
  ON public.jobs FOR UPDATE
  TO authenticated
  USING (auth.uid() = owner);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_jobs_owner ON public.jobs(owner);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON public.jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_type ON public.jobs(type);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON public.jobs(created_at DESC);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.jobs_updated_at_trigger()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- Trigger to automatically update updated_at
CREATE TRIGGER trg_jobs_updated_at
BEFORE UPDATE ON public.jobs
FOR EACH ROW EXECUTE FUNCTION public.jobs_updated_at_trigger();

-- Function to broadcast job changes via realtime
CREATE OR REPLACE FUNCTION public.jobs_broadcast_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  channel_name text;
  operation_type text;
BEGIN
  -- Create channel name: job:{job_id}
  channel_name := 'job:' || COALESCE(NEW.id::text, OLD.id::text);
  operation_type := TG_OP;

  -- Broadcast the change
  PERFORM realtime.broadcast_changes(
    channel_name,
    operation_type,
    operation_type,
    TG_TABLE_NAME,
    TG_TABLE_SCHEMA,
    NEW,
    OLD
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Trigger to broadcast changes
CREATE TRIGGER trg_jobs_broadcast
AFTER INSERT OR UPDATE OR DELETE ON public.jobs
FOR EACH ROW EXECUTE FUNCTION public.jobs_broadcast_trigger();

-- Function to update job progress (convenience function)
CREATE OR REPLACE FUNCTION public.update_job_progress(
  job_id uuid,
  new_progress integer DEFAULT NULL,
  new_message text DEFAULT NULL,
  new_status text DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.jobs
  SET
    progress = COALESCE(new_progress, progress),
    message = COALESCE(new_message, message),
    status = COALESCE(new_status, status),
    updated_at = now(),
    started_at = CASE WHEN new_status = 'running' AND started_at IS NULL THEN now() ELSE started_at END,
    completed_at = CASE WHEN new_status IN ('completed', 'failed', 'cancelled') THEN now() ELSE completed_at END
  WHERE id = job_id;
END;
$$;