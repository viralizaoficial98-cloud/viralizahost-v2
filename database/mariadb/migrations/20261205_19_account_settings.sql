-- Configurações → Contas: «Exigir confirmação de e-mail para novos clientes» (persistente, sem reinício).
-- Sem linha (ou valor NULL) mantém o comportamento actual: AUTH_EMAIL_CONFIRMATION != 'false' → exigida.
-- Idempotente; não altera contas existentes.
CREATE TABLE IF NOT EXISTS account_settings (
  id TINYINT NOT NULL PRIMARY KEY,
  email_confirmation_required TINYINT(1) NULL,
  updated_by CHAR(36) NULL,
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Contas criadas com a confirmação desactivada: e-mail continua NÃO verificado, mas podem iniciar sessão.
-- Reactivar a opção afecta apenas registos novos (estas contas mantêm a isenção). Contas existentes: 0 (sem mudança).
ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS email_verification_exempt TINYINT(1) NOT NULL DEFAULT 0;
