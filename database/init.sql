-- migration_init.sql

CREATE TABLE IF NOT EXISTS cache (
  id TEXT PRIMARY KEY,
  data JSONB,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS messages (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  message_text TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE   -- TTL support
);

CREATE INDEX IF NOT EXISTS idx_messages_userid ON messages(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_expires ON messages(expires_at);
