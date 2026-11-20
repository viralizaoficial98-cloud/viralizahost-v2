-- whm_accounts tinha UNIQUE(server_id, primary_domain): uma conta com o mesmo domínio
-- sobrescrevia outra na importação. O identificador estável é (server_id, whm_username),
-- que se mantém; conflitos de domínio passam a ser assinalados, não sobrescritos.
ALTER TABLE `whm_accounts` DROP INDEX IF EXISTS `whm_accounts_server_id_primary_domain_key`;
