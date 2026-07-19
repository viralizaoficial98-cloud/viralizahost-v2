-- AI Agent tables in viralizahost schema
-- ai_conversations: one per chat session
-- ai_messages: all messages in each conversation
-- ai_audit_logs: every tool call executed by the agent

-- Conversations
CREATE TABLE IF NOT EXISTS viralizahost.ai_conversations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  session_token TEXT,                         -- for anonymous visitors (no auth)
  title         TEXT,                         -- auto-generated from first message
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'abandoned')),
  user_level    TEXT NOT NULL DEFAULT 'visitor' CHECK (user_level IN ('visitor', 'client', 'admin')),
  metadata      JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Messages
CREATE TABLE IF NOT EXISTS viralizahost.ai_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES viralizahost.ai_conversations(id) ON DELETE CASCADE,
  role            TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'tool')),
  content         TEXT NOT NULL,
  tool_name       TEXT,           -- populated when role = 'tool'
  tool_input      JSONB,          -- the arguments passed to the tool
  tool_output     JSONB,          -- the result returned by the tool
  tokens_used     INTEGER,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Audit log: every agent tool call
CREATE TABLE IF NOT EXISTS viralizahost.ai_audit_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES viralizahost.ai_conversations(id) ON DELETE SET NULL,
  profile_id      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  tool_name       TEXT NOT NULL,
  tool_input      JSONB,
  result_summary  TEXT,           -- short human-readable outcome (no sensitive data)
  success         BOOLEAN NOT NULL DEFAULT true,
  error_message   TEXT,
  ip_address      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS ai_conversations_profile_id_idx ON viralizahost.ai_conversations(profile_id);
CREATE INDEX IF NOT EXISTS ai_conversations_session_token_idx ON viralizahost.ai_conversations(session_token);
CREATE INDEX IF NOT EXISTS ai_messages_conversation_id_idx ON viralizahost.ai_messages(conversation_id);
CREATE INDEX IF NOT EXISTS ai_audit_logs_profile_id_idx ON viralizahost.ai_audit_logs(profile_id);
CREATE INDEX IF NOT EXISTS ai_audit_logs_created_at_idx ON viralizahost.ai_audit_logs(created_at);

-- updated_at trigger
CREATE OR REPLACE FUNCTION viralizahost.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS ai_conversations_updated_at ON viralizahost.ai_conversations;
CREATE TRIGGER ai_conversations_updated_at
  BEFORE UPDATE ON viralizahost.ai_conversations
  FOR EACH ROW EXECUTE FUNCTION viralizahost.set_updated_at();

-- RLS
ALTER TABLE viralizahost.ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE viralizahost.ai_messages      ENABLE ROW LEVEL SECURITY;
ALTER TABLE viralizahost.ai_audit_logs    ENABLE ROW LEVEL SECURITY;

-- Conversations: owner can read their own; admins read all
CREATE POLICY "owner_read_conversations" ON viralizahost.ai_conversations
  FOR SELECT USING (profile_id = auth.uid() OR viralizahost.is_admin());

CREATE POLICY "service_role_all_conversations" ON viralizahost.ai_conversations
  FOR ALL USING (auth.role() = 'service_role');

-- Messages: same as conversations
CREATE POLICY "owner_read_messages" ON viralizahost.ai_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM viralizahost.ai_conversations c
      WHERE c.id = ai_messages.conversation_id
        AND (c.profile_id = auth.uid() OR viralizahost.is_admin())
    )
  );

CREATE POLICY "service_role_all_messages" ON viralizahost.ai_messages
  FOR ALL USING (auth.role() = 'service_role');

-- Audit logs: admins only
CREATE POLICY "admin_read_audit" ON viralizahost.ai_audit_logs
  FOR SELECT USING (viralizahost.is_admin());

CREATE POLICY "service_role_all_audit" ON viralizahost.ai_audit_logs
  FOR ALL USING (auth.role() = 'service_role');
