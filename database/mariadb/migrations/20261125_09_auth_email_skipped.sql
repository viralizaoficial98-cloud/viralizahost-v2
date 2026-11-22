-- auth_email_log passa a registar também os pedidos que não chegam ao Resend
-- (conta inexistente, já verificada, suspensa, limite atingido ou domínio de destino
-- sem servidor de correio). A resposta pública do reenvio continua genérica.
ALTER TABLE auth_email_log MODIFY status ENUM('accepted','failed','not_configured','skipped','rate_limited','undeliverable') NOT NULL;
