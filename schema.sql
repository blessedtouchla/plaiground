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
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT users_email_unique UNIQUE (email),
  CONSTRAINT users_plan_check CHECK (plan IS NULL OR plan IN ('basic', 'creator', 'pro'))
);
