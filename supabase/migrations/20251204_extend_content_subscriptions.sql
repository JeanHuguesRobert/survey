-- Migration: Extend content_subscriptions for all content types
-- Date: 2025-12-04
-- Description: Refactor subscription system with extended types and metadata

-- Step 1: Drop existing constraint
ALTER TABLE public.content_subscriptions
DROP CONSTRAINT IF EXISTS content_subscriptions_content_type_check;

-- Step 2: Add new constraint with all content types
ALTER TABLE public.content_subscriptions
ADD CONSTRAINT content_subscriptions_content_type_check
CHECK (content_type IN (
  'post',
  'proposition',
  'wiki_page',
  'user',
  'group',
  'mission',
  'task_project',
  'fil_item',
  'tag'
));

-- Step 3: Add metadata column if not exists (for digest data)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'content_subscriptions'
    AND column_name = 'metadata'
  ) THEN
    ALTER TABLE public.content_subscriptions
    ADD COLUMN metadata jsonb DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- Step 4: Add last_activity_at for sorting by recent activity
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'content_subscriptions'
    AND column_name = 'last_activity_at'
  ) THEN
    ALTER TABLE public.content_subscriptions
    ADD COLUMN last_activity_at timestamptz DEFAULT now();
  END IF;
END $$;

-- Step 5: Create index for efficient notification queries
CREATE INDEX IF NOT EXISTS idx_content_subscriptions_user_activity
ON public.content_subscriptions(user_id, last_activity_at DESC);

-- Step 6: Create index for unread count queries (JSONB)
CREATE INDEX IF NOT EXISTS idx_content_subscriptions_unread
ON public.content_subscriptions((metadata->>'unread_count'))
WHERE metadata->>'unread_count' IS NOT NULL;

-- Step 7: Function to increment unread count
CREATE OR REPLACE FUNCTION increment_subscription_unread(
  p_content_type text,
  p_content_id uuid,
  p_activity_type text DEFAULT 'comment',
  p_actor_name text DEFAULT NULL,
  p_preview text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  updated_count integer;
BEGIN
  UPDATE content_subscriptions
  SET
    last_activity_at = now(),
    metadata = jsonb_set(
      jsonb_set(
        COALESCE(metadata, '{}'::jsonb),
        '{unread_count}',
        to_jsonb(COALESCE((metadata->>'unread_count')::int, 0) + 1)
      ),
      '{last_activity}',
      jsonb_build_object(
        'type', p_activity_type,
        'actor', p_actor_name,
        'preview', left(p_preview, 100),
        'at', now()
      )
    )
  WHERE content_type = p_content_type
    AND content_id = p_content_id;

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

-- Step 8: Function to mark subscription as read
CREATE OR REPLACE FUNCTION mark_subscription_read(
  p_user_id uuid,
  p_content_type text,
  p_content_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE content_subscriptions
  SET metadata = jsonb_set(
    jsonb_set(
      COALESCE(metadata, '{}'::jsonb),
      '{unread_count}',
      '0'
    ),
    '{last_seen_at}',
    to_jsonb(now())
  )
  WHERE user_id = p_user_id
    AND content_type = p_content_type
    AND content_id = p_content_id;

  RETURN FOUND;
END;
$$;

-- Step 9: Function to get total unread for a user (for badge)
CREATE OR REPLACE FUNCTION get_user_unread_count(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  total integer;
BEGIN
  SELECT COALESCE(SUM((metadata->>'unread_count')::int), 0)
  INTO total
  FROM content_subscriptions
  WHERE user_id = p_user_id;

  RETURN total;
END;
$$;

-- Comment
COMMENT ON TABLE public.content_subscriptions IS
  'Abonnements utilisateurs à tout type de contenu avec suivi d''activité';
