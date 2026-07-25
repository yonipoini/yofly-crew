-- Ops intel infrastructure: cache, push subscriptions, dispatch queue, and digests

CREATE TABLE IF NOT EXISTS ops_snapshots (
  airport_code TEXT PRIMARY KEY,
  snapshot JSONB NOT NULL,
  snapshot_hash TEXT,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS notification_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  expo_push_token TEXT NOT NULL UNIQUE,
  platform TEXT,
  active_airport TEXT,
  saved_airports TEXT[] DEFAULT ARRAY[]::TEXT[],
  preferred_airlines TEXT[] DEFAULT ARRAY[]::TEXT[],
  role_label TEXT,
  verified_crew BOOLEAN DEFAULT FALSE,
  intel_push BOOLEAN DEFAULT TRUE,
  ops_push BOOLEAN DEFAULT TRUE,
  daily_digest BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ops_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  airport_code TEXT NOT NULL,
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  payload JSONB DEFAULT '{}'::JSONB,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ops_notification_inbox (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  event_id UUID REFERENCES ops_events(id) ON DELETE SET NULL,
  category TEXT NOT NULL DEFAULT 'OPS_ALERT',
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::JSONB,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ops_digests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  digest_type TEXT NOT NULL,
  airport_code TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  payload JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ops_events_unsent ON ops_events (sent_at, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_subscriptions_user ON notification_subscriptions (user_id);
CREATE INDEX IF NOT EXISTS idx_ops_notification_inbox_user ON ops_notification_inbox (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ops_digests_user ON ops_digests (user_id, created_at DESC);

ALTER TABLE ops_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops_notification_inbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops_digests ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'ops_snapshots'
      AND policyname = 'Public read ops snapshots'
  ) THEN
    CREATE POLICY "Public read ops snapshots" ON ops_snapshots FOR SELECT USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'notification_subscriptions'
      AND policyname = 'Users manage own push subscriptions'
  ) THEN
    CREATE POLICY "Users manage own push subscriptions" ON notification_subscriptions
      FOR ALL TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'ops_notification_inbox'
      AND policyname = 'Users read own ops inbox'
  ) THEN
    CREATE POLICY "Users read own ops inbox" ON ops_notification_inbox
      FOR SELECT TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'ops_notification_inbox'
      AND policyname = 'Users update own ops inbox'
  ) THEN
    CREATE POLICY "Users update own ops inbox" ON ops_notification_inbox
      FOR UPDATE TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'ops_digests'
      AND policyname = 'Users read own ops digests'
  ) THEN
    CREATE POLICY "Users read own ops digests" ON ops_digests
      FOR SELECT TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;
