-- Registo dos e-mails de autenticação (verificação, recuperação, teste) e do resultado
-- devolvido pelo Resend. Nunca guarda o link nem o token — só o identificador da mensagem.
CREATE TABLE IF NOT EXISTS auth_email_log (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36) NULL,
  kind VARCHAR(16) NOT NULL,
  recipient VARCHAR(255) NOT NULL,
  provider_id VARCHAR(64) NULL,
  status ENUM('accepted','failed','not_configured') NOT NULL,
  error VARCHAR(300) NULL,
  last_event VARCHAR(32) NULL,
  last_event_at DATETIME(6) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  KEY auth_email_log_user (user_id, created_at),
  KEY auth_email_log_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
