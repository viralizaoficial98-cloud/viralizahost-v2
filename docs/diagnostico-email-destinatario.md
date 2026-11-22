# Diagnóstico: e-mail de verificação não chega a um destinatário

Caso analisado: `comercial@3manuelseguranca.ao` (22/11/2026).

## O que ficou comprovado sem acesso ao servidor

| Etapa | Resultado | Como foi verificado |
|---|---|---|
| Versão em produção | `2fd8869`, merge do PR #35: reenvio e registo de envios publicados | `https://viralizahost.com/api/version` |
| DNS do destinatário | **`3manuelseguranca.ao` não existe no DNS público (NXDOMAIN)**: sem MX, sem A. A resposta vem da autoridade do registo `.ao` (`a.ns.ao`, `hostmaster.dns.ao`). As variantes `.co.ao`, `emanuelseguranca.ao`, `manuelseguranca.ao` e `.com` também não existem. | `dns.google/resolve?name=3manuelseguranca.ao&type=MX` → `Status 3` |
| DNS do remetente (Resend) | `resend._domainkey.viralizahost.com` (DKIM) publicado; MX `send.viralizahost.com` → `feedback-smtp.sa-east-1.amazonses.com` publicado; **TXT (SPF) em `send.viralizahost.com` em falta** | mesmas consultas |

**Conclusão:** o Resend envia através da Amazon SES, que procura o MX de `3manuelseguranca.ao` no DNS público. Como o domínio não existe, a mensagem não pode ser entregue: é devolvida ou suprimida. Isto acontece mesmo que a caixa exista no nosso cPanel e o Webmail funcione. O correio entre contas do mesmo servidor é entregue localmente, mas o da Internet não chega.

A falta do SPF em `send.viralizahost.com` é um segundo problema e afecta **todos** os destinatários:

- o Resend pode não considerar o domínio verificado e recusar o envio;
- ou aceitar o envio com pior reputação de entrega.

Por desenho, o aviso verde do reenvio é igual com ou sem envio. Antes desta correcção, os reenvios que não chegavam ao Resend (conta inexistente, já verificada, limite) não deixavam rasto.

## Comandos no servidor (só leitura)

Os comandos não mostram chaves nem links. Os e-mails nos logs aparecem mascarados.

```bash
cd /var/www/viralizahost
DB=viralizahost_viralizaHost; MY="--defaults-extra-file=$HOME/.vh-my.cnf"

# 1. Migração do PR #35 aplicada?
mysql $MY $DB -e "SELECT name, applied_at FROM vh_schema_migrations WHERE name LIKE '2026112%'"

# 2. A conta existe com a grafia exacta? Está por verificar? (e contas parecidas)
mysql $MY $DB -e "SELECT email, email_confirmed_at IS NULL AS por_verificar, banned_until, created_at FROM auth_users WHERE email LIKE '%manuelseguranca%'"

# 3. O que aconteceu aos pedidos (aceite / recusado / sem chave / domínio sem correio / sem conta / limite)
mysql $MY $DB -e "SELECT created_at, kind, status, provider_id IS NOT NULL AS tem_id_resend, last_event, LEFT(error,160) AS motivo FROM auth_email_log WHERE recipient LIKE '%manuelseguranca%' ORDER BY created_at DESC LIMIT 20"

# 4. Logs do processo (e-mails mascarados)
pm2 logs viralizahost --lines 400 --nostream 2>/dev/null | grep -E "auth/email|resend-verification" | sed -E 's/[A-Za-z0-9._%+-]+@/***@/g' | tail -30

# 5. Configuração efectiva (só presença; valores públicos à parte)
for k in RESEND_API_KEY RESEND_FROM_EMAIL RESEND_FROM_NAME; do grep -q "^$k=." .env.local && echo "$k: definido" || echo "$k: EM FALTA"; done
grep -E '^(NEXT_PUBLIC_SITE_URL|AUTH_EMAIL_CONFIRMATION|RESEND_FROM_EMAIL)=' .env.local

# 6. O domínio do cliente está alojado aqui? Está delegado na Internet?
grep -i 3manuelseguranca /etc/localdomains /etc/remotedomains /etc/userdomains 2>/dev/null
dig +short NS 3manuelseguranca.ao @a.ns.ao ; dig +short MX 3manuelseguranca.ao @8.8.8.8
mysql $MY $DB -e "SELECT CONCAT(name, extension) dominio, status, order_id, registered_at FROM domains WHERE name LIKE '%manuelseguranca%'"

# 7. Só se o Resend indicar «Entregue»: rastreio no Exim local
exigrep -i 3manuelseguranca.ao /var/log/exim_mainlog | tail -40
```

## Correcção

### A. Domínio do cliente (`3manuelseguranca.ao`): causa directa
O domínio tem de existir no DNS público e apontar para o servidor de correio.

1. Confirmar com o passo 6 se o domínio foi encomendado à ViralizaHost e ainda não foi registado (`domains.status = pending`), ou se nunca foi registado ou expirou.
2. Registar ou renovar o domínio no DNS.AO, através de um registrar acreditado, com os servidores de nomes `ns1.viralizahost.com` e `ns2.viralizahost.com`. Isto só se aplica se a zona estiver no nosso cPanel (passo 6: aparece em `/etc/userdomains`).
3. Esperar a delegação e confirmar:
   ```bash
   dig +short NS 3manuelseguranca.ao @a.ns.ao
   dig +short MX 3manuelseguranca.ao @8.8.8.8
   ```
   O resultado deve mostrar os NS e um MX.
4. Se tentativas anteriores foram aceites pelo Resend e devolvidas, o endereço pode estar na lista de supressão. No painel do Resend, abrir **Emails**, filtrar pelo destinatário e, se aparecer «Suppressed» ou «Bounced», removê-lo da supressão.
5. Pedir **Reenviar e-mail de verificação**. Até o domínio existir, a aplicação já não chama o Resend para este endereço: regista «Não enviado (domínio sem correio)».

Alternativa imediata para o cliente: registar-se com um endereço cujo domínio já recebe correio da Internet.

### B. SPF do remetente (`send.viralizahost.com`): afecta todos os envios
1. No Resend, abrir **Domains → viralizahost.com** e copiar o registo **TXT** do nome `send`. O valor costuma ser `v=spf1 include:amazonses.com ~all`; usar exactamente o que o Resend mostrar.
2. No WHM/cPanel, abrir **Zone Editor → viralizahost.com → Add Record → TXT**, com nome `send` e esse valor.
3. Confirmar:
   ```bash
   dig +short TXT send.viralizahost.com @8.8.8.8
   ```
4. No Resend, clicar **Verify DNS Records** e esperar o estado «Verified».
5. Confirmar no painel: **Integrações → E-mail transaccional → Verificar domínio**. A lista de registos DNS deve mostrar os três a verde.

## Teste final (com uma caixa autorizada)
1. **Integrações → E-mail transaccional → Diagnosticar um destinatário** com o endereço: deve indicar conta por verificar e «Domínio recebe correio».
2. **Enviar teste** para uma segunda caixa da equipa, num domínio que já recebe correio, e depois **Actualizar estado de entrega**: deve aparecer «Entregue».
3. Na página pública `/verificar-email`, pedir o reenvio para o endereço do cliente. Anotar a hora de Luanda e confirmar no diagnóstico do destinatário a linha «Aceite pelo Resend» e depois «Entregue».
4. Abrir a mensagem no Webmail: o link começa por `https://viralizahost.com/api/auth/verify`. Abri-lo deve levar à Área do Cliente.
5. Em **Clientes**, a conta deve passar a «E-mail verificado».
