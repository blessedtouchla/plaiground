-- PLAIGROUND account store. Run on first auth request or GET /api/auth.
-- Emails are stored lowercased; uniqueness is on that stored value.

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  password_hash text NOT NULL,
  artist_name text NOT NULL,
  plan text,
  status text NOT NULL DEFAULT 'active',
  stripe_customer_id text,
  stripe_session_id text,
  tonegrid_artist_id text,
  tonegrid_release_ids text[] NOT NULL DEFAULT ARRAY[]::text[],
  tonegrid_track_ids text[] NOT NULL DEFAULT ARRAY[]::text[],
  tonegrid_release_at timestamptz[] NOT NULL DEFAULT ARRAY[]::timestamptz[],
  email_confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT users_email_unique UNIQUE (email),
  CONSTRAINT users_plan_check CHECK (plan IS NULL OR plan IN ('basic', 'creator', 'pro')),
  CONSTRAINT users_status_check CHECK (status IN ('active', 'warning', 'hold'))
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS tonegrid_track_ids text[] NOT NULL DEFAULT ARRAY[]::text[];
ALTER TABLE users ADD COLUMN IF NOT EXISTS tonegrid_release_at timestamptz[] NOT NULL DEFAULT ARRAY[]::timestamptz[];
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_confirmed_at timestamptz;
ALTER TABLE users ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_status_check;
ALTER TABLE users ADD CONSTRAINT users_status_check CHECK (status IN ('active', 'warning', 'hold'));

CREATE TABLE IF NOT EXISTS schema_meta (
  key text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audio_upload_chunks (
  upload_id text NOT NULL,
  user_id text NOT NULL,
  track_id text NOT NULL,
  chunk_index integer NOT NULL,
  chunk_count integer NOT NULL,
  filename text NOT NULL DEFAULT '',
  mime text NOT NULL DEFAULT '',
  payload text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (upload_id, chunk_index)
);

WITH flag AS (
  INSERT INTO schema_meta (key) VALUES ('users_email_confirmed_backfill')
  ON CONFLICT (key) DO NOTHING
  RETURNING key
)
UPDATE users SET email_confirmed_at = created_at
WHERE email_confirmed_at IS NULL
  AND EXISTS (SELECT 1 FROM flag);
