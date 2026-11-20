-- domains tinha UNIQUE(name) herdado do PostgreSQL: impedia exemplo.com e exemplo.ao
-- em simultâneo e fazia colidir domínios de extensões diferentes. A chave correcta
-- (name, extension) já existe e mantém-se. Não altera dados.
ALTER TABLE `domains` DROP INDEX IF EXISTS `domains_name_key`;
