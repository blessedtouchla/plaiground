-- PLAIGROUND account store. Run on first auth request or GET /api/auth.
-- Emails are stored lowercased; uniqueness is on that stored value.

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  password_hash text NOT NULL,
  artist_name text NOT NULL,
  plan text,
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
  CONSTRAINT users_plan_check CHECK (plan IS NULL OR plan IN ('basic', 'creator', 'pro'))
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS tonegrid_track_ids text[] NOT NULL DEFAULT ARRAY[]::text[];
ALTER TABLE users ADD COLUMN IF NOT EXISTS tonegrid_release_at timestamptz[] NOT NULL DEFAULT ARRAY[]::timestamptz[];
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_confirmed_at timestamptz;

CREATE TABLE IF NOT EXISTS schema_meta (
  key text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

WITH flag AS (
  INSERT INTO schema_meta (key) VALUES ('users_email_confirmed_backfill')
  ON CONFLICT (key) DO NOTHING
  RETURNING key
)
UPDATE users SET email_confirmed_at = created_at
WHERE email_confirmed_at IS NULL
  AND EXISTS (SELECT 1 FROM flag);
