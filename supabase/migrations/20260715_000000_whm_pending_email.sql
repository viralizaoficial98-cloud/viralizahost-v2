-- ============================================================
-- WHM pending email support
-- Adds sync_status, requires_manual_link, link_status, notes
-- to whm_accounts so accounts without valid email can be
-- imported but flagged for manual association.
-- ============================================================

ALTER TABLE viralizahost.whm_accounts
  ADD COLUMN IF NOT EXISTS sync_status          TEXT    NOT NULL DEFAULT 'linked',
  ADD COLUMN IF NOT EXISTS requires_manual_link BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS link_status          TEXT    NOT NULL DEFAULT 'linked',
  ADD COLUMN IF NOT EXISTS notes                TEXT;

-- sync_status: 'linked' | 'pending_email'
-- link_status: 'linked' | 'unlinked'

CREATE INDEX IF NOT EXISTS idx_whm_accounts_sync_status ON viralizahost.whm_accounts(sync_status);
