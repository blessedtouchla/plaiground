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
CREATE UNIQUE INDEX IF NOT EXISTS users_username_unique
  ON users (lower(btrim(profile->>'username')))
  WHERE COALESCE(btrim(profile->>'username'), '') <> '';
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

CREATE TABLE IF NOT EXISTS user_events (
  user_id uuid NOT NULL,
  event_name text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, event_name),
  CONSTRAINT user_events_name_check CHECK (event_name IN ('signup', 'first_upload', 'first_store_live', 'paid'))
);

CREATE TABLE IF NOT EXISTS community_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  artist_name text NOT NULL DEFAULT '',
  title text NOT NULL,
  made text NOT NULL,
  humans text[] NOT NULL DEFAULT ARRAY[]::text[],
  platform text NOT NULL DEFAULT '',
  badges text[] NOT NULL DEFAULT ARRAY[]::text[],
  audio_name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT community_posts_made_check CHECK (made IN ('full_ai', 'ai_assisted', 'no_ai'))
);

-- One row per save. Edits append history; they do not overwrite older plans.
CREATE TABLE IF NOT EXISTS roadmap_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  plan jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS roadmap_plans_user_created_idx
  ON roadmap_plans (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS artist_profile_saves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  profiles jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS artist_profile_saves_user_created_idx
  ON artist_profile_saves (user_id, created_at DESC);

-- One row per save. A new save appends. It does not overwrite older songs.
CREATE TABLE IF NOT EXISTS saved_lyrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  song jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS saved_lyrics_user_created_idx
  ON saved_lyrics (user_id, created_at DESC);

-- Every product usage occurrence. Rollups keep count, first_at, and last_at.
CREATE TABLE IF NOT EXISTS product_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  event_name text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS product_events_user_created_idx
  ON product_events (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS product_events_name_created_idx
  ON product_events (event_name, created_at DESC);

CREATE TABLE IF NOT EXISTS product_event_rollups (
  user_id uuid NOT NULL,
  event_name text NOT NULL,
  event_count integer NOT NULL DEFAULT 0,
  first_at timestamptz NOT NULL,
  last_at timestamptz NOT NULL,
  PRIMARY KEY (user_id, event_name)
);

-- Launch sprint counts. No email or name.
-- user_id is set only after signup or login so earlier visits stay with the account.
-- The owner report never returns user_id, click ids, or free text.
CREATE TABLE IF NOT EXISTS marketing_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id text NOT NULL,
  event_name text NOT NULL,
  utm_source text NOT NULL DEFAULT '',
  utm_medium text NOT NULL DEFAULT '',
  utm_campaign text NOT NULL DEFAULT '',
  utm_content text NOT NULL DEFAULT '',
  utm_term text NOT NULL DEFAULT '',
  fbclid text NOT NULL DEFAULT '',
  ttclid text NOT NULL DEFAULT '',
  gclid text NOT NULL DEFAULT '',
  tool text NOT NULL DEFAULT '',
  step text NOT NULL DEFAULT '',
  segment text NOT NULL DEFAULT '',
  angle text NOT NULL DEFAULT '',
  version text NOT NULL DEFAULT '',
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE marketing_events ADD COLUMN IF NOT EXISTS tool text NOT NULL DEFAULT '';
ALTER TABLE marketing_events ADD COLUMN IF NOT EXISTS step text NOT NULL DEFAULT '';
ALTER TABLE marketing_events ADD COLUMN IF NOT EXISTS segment text NOT NULL DEFAULT '';
ALTER TABLE marketing_events ADD COLUMN IF NOT EXISTS angle text NOT NULL DEFAULT '';
ALTER TABLE marketing_events ADD COLUMN IF NOT EXISTS version text NOT NULL DEFAULT '';
ALTER TABLE marketing_events ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE marketing_events ADD COLUMN IF NOT EXISTS path text NOT NULL DEFAULT '';
ALTER TABLE marketing_events ADD COLUMN IF NOT EXISTS referrer text NOT NULL DEFAULT '';
ALTER TABLE marketing_events ADD COLUMN IF NOT EXISTS user_agent text NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS marketing_events_created_idx
  ON marketing_events (created_at DESC);

CREATE INDEX IF NOT EXISTS marketing_events_visitor_idx
  ON marketing_events (visitor_id, event_name, created_at DESC);

-- Waitlist applications. No password. No account required.
CREATE TABLE IF NOT EXISTS applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL,
  package text NOT NULL,
  help text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS applications_created_idx
  ON applications (created_at DESC);

-- Artist emails that did not send. No password, key, or secret.
CREATE TABLE IF NOT EXISTS mail_failures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL DEFAULT '',
  event_name text NOT NULL DEFAULT '',
  to_email text NOT NULL DEFAULT '',
  subject text NOT NULL DEFAULT '',
  error text NOT NULL DEFAULT '',
  release_id text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mail_failures_created_idx
  ON mail_failures (created_at DESC);

-- One row so the owner test-email button cannot fire again inside a minute.
CREATE TABLE IF NOT EXISTS owner_mail_limits (
  name text PRIMARY KEY,
  sent_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chart_artists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  ai_label text NOT NULL DEFAULT 'Unknown',
  ai_source_name text NOT NULL DEFAULT '',
  ai_source_url text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chart_songs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id uuid NOT NULL,
  title text NOT NULL,
  slug text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chart_songs_slug_unique UNIQUE (slug)
);

CREATE TABLE IF NOT EXISTS chart_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id uuid NOT NULL,
  chart_name text NOT NULL DEFAULT '',
  position integer,
  chart_date date,
  source_name text NOT NULL DEFAULT '',
  source_url text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chart_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id uuid NOT NULL,
  metric text NOT NULL,
  value_text text NOT NULL DEFAULT '',
  source_name text NOT NULL DEFAULT '',
  source_url text NOT NULL DEFAULT '',
  as_of date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS chart_snapshots_day
  ON chart_snapshots (song_id, metric, as_of);

CREATE TABLE IF NOT EXISTS chart_corrections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  song_slug text NOT NULL DEFAULT '',
  field_name text NOT NULL DEFAULT '',
  message text NOT NULL,
  source_url text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE chart_artists ADD COLUMN IF NOT EXISTS ai_note text NOT NULL DEFAULT '';
ALTER TABLE chart_songs ADD COLUMN IF NOT EXISTS genre text NOT NULL DEFAULT '';
ALTER TABLE chart_songs ADD COLUMN IF NOT EXISTS scope_tag text NOT NULL DEFAULT '';
ALTER TABLE chart_songs ADD COLUMN IF NOT EXISTS youtube_video_id text NOT NULL DEFAULT '';
ALTER TABLE chart_songs ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;
ALTER TABLE chart_sources ADD COLUMN IF NOT EXISTS position_label text NOT NULL DEFAULT '';
ALTER TABLE chart_sources ADD COLUMN IF NOT EXISTS chart_date_text text NOT NULL DEFAULT '';

-- One live note per release. The first live event stays on user_events.
CREATE TABLE IF NOT EXISTS artist_mail_sent (
  user_id text NOT NULL,
  kind text NOT NULL,
  release_id text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, kind, release_id)
);
