# Contas de cliente: verificação de e-mail e eliminação

## 1. Verificação de e-mail

### Percurso no código
1. **Formulário** `/register` → `POST /api/auth/signup` (`src/app/api/auth/signup/route.ts`).
2. **Conta**: `createUser()` cria `auth_users` (sem `email_confirmed_at`) e `profiles` com papel `client`.
3. **Token**: `sendVerificationEmail()` (`src/lib/auth/verification.ts`):
   - invalida os links anteriores ainda não usados;
   - cria um token aleatório com validade de 24 h (guardado só como hash em `auth_tokens`).
4. **Pedido de envio**: `sendAuthEmail()` (`src/lib/auth/email.ts`) faz `POST https://api.resend.com/emails`. Variáveis lidas **pelo processo em execução**:
   - `RESEND_API_KEY` (obrigatória);
   - `RESEND_FROM_EMAIL` (por omissão `comercial@viralizahost.com`);
   - `RESEND_FROM_NAME` (por omissão `ViralizaHost`).
5. **Resposta do Resend**: fica registada em `auth_email_log`:
   - `accepted`, com o id da mensagem;
   - `failed`, com o motivo;
   - `not_configured`, quando falta a chave.

   Nunca se guarda o link nem o token.
6. **Entrega**: o evento (`delivered`, `bounced`, …) é consultado no Resend em **Integrações → E-mail transaccional → Actualizar estado de entrega**. «Aceite» não é o mesmo que «entregue».
7. **Link**: `${NEXT_PUBLIC_SITE_URL}/api/auth/verify?type=signup&token_hash=…`.
   - `NEXT_PUBLIC_SITE_URL` fica fixado no **build** e tem de ser `https://viralizahost.com`.
   - Se faltar, usa `NEXT_PUBLIC_APP_URL`; se também faltar, usa `https://viralizahost.com`.
8. **Confirmação**: `GET /api/auth/verify` consome o token uma única vez, preenche `email_confirmed_at`, inicia sessão e leva a `/dashboard?verificado=1`. Link expirado, já usado ou inválido leva a `/verificar-email?estado=…`, com a mensagem e o reenvio.

### Causa encontrada no código
Quando o Resend recusava o envio ou a chave faltava, o registo devolvia **erro 500**. A conta ficava criada mas por verificar, e não existia forma de reenviar:

- um novo registo dizia «já registado»;
- o login dizia «Email not confirmed», em inglês.

Agora:

- a conta fica por verificar e o formulário diz que o e-mail não foi enviado;
- há **Reenviar e-mail de verificação** em `/verificar-email`, no erro de login e no painel (Clientes → ⋮).

A etapa exacta em que a produção falha só se confirma no servidor (abaixo):

- `not_configured`: falta `RESEND_API_KEY` ao processo;
- `failed` com 403/422: domínio do remetente não verificado ou recusado;
- `accepted` sem `delivered`: entrega (spam ou devolução).

### Diagnóstico em produção (só leitura, sem mostrar valores)
```bash
cd /var/www/viralizahost
for k in RESEND_API_KEY RESEND_FROM_EMAIL RESEND_FROM_NAME; do grep -q "^$k=." .env.local && echo "$k: definido" || echo "$k: EM FALTA"; done
grep -E '^(NEXT_PUBLIC_SITE_URL|AUTH_EMAIL_CONFIRMATION|RESEND_FROM_EMAIL)=' .env.local     # valores públicos
mysql --defaults-extra-file="$HOME/.vh-my.cnf" viralizahost_viralizaHost -e "SELECT status, kind, LEFT(error,120) erro, last_event, created_at FROM auth_email_log ORDER BY created_at DESC LIMIT 10"
```
Depois de publicar, com sessão de administrador, abrir **Integrações → E-mail transaccional**. A página lê o processo em execução e:

- confirma a chave, o remetente, o início dos links e se a verificação é exigida;
- verifica o domínio do remetente no Resend;
- envia um e-mail de teste e mostra se foi «Aceite» e depois «Entregue» ou «Devolvido».

### Configurar o Resend (se o diagnóstico indicar falta de chave ou domínio)
1. Em resend.com, entrar na conta da ViralizaHost e abrir **Domains → Add Domain** → `viralizahost.com`.
2. Copiar os registos DNS que o Resend indica (SPF/MX do subdomínio de envio e DKIM). Criá-los no **cPanel → Zone Editor** de `viralizahost.com`, sem alterar o MX principal do domínio.
3. Voltar ao Resend e clicar **Verify DNS Records**. Esperar o estado «Verified».
4. Abrir **API Keys → Create API Key**: permissão **Sending access**, domínio `viralizahost.com`. Copiar a chave, que só é mostrada uma vez.
5. No servidor, editar `/var/www/viralizahost/.env.local` (sem colar a chave em chats ou tickets):
   ```
   RESEND_API_KEY=<chave>
   RESEND_FROM_EMAIL=comercial@viralizahost.com
   RESEND_FROM_NAME=ViralizaHost
   NEXT_PUBLIC_SITE_URL=https://viralizahost.com
   ```
   A exigência de confirmação controla-se em **Configurações → Contas** (ver `docs/publicacao-vps-contas-bandeiras.md`); `AUTH_EMAIL_CONFIRMATION` só define o valor inicial.
6. Reiniciar o processo: `pm2 restart viralizahost`. Se `NEXT_PUBLIC_SITE_URL` mudou, compilar antes com `npm run build`.
7. Testar e confirmar a entrega:
   - **Integrações → E-mail transaccional → Enviar teste** para uma caixa da equipa;
   - depois **Actualizar estado de entrega**: deve aparecer «Entregue»;
   - o painel do Resend (**Emails**) mostra o mesmo evento.

«Verificar domínio» no painel precisa de uma chave com leitura (Full access). Com uma chave só de envio, a página diz isso e o estado confirma-se no próprio Resend.

### Regras do link e do reenvio
- O link expira em 24 h, só pode ser usado uma vez, e um reenvio invalida os links anteriores.
- Reenvio: limite de 3 pedidos por endereço e 20 por IP por hora. A resposta é sempre a mesma, quer o endereço exista ou não, quer já esteja verificado ou não.
- A recuperação de senha mantém-se: link de 60 minutos, uso único.
- Conta por verificar **não** é elegível para associação a contas WHM (PR #34).

## 2. Eliminação de contas (Clientes → ⋮)

**Causa:** a opção não existia. O menu ⋮ não tinha «Eliminar» e a API não tinha `DELETE`.

Além disso, a lista mostrava todos os perfis, incluindo contas administrativas com registo de cliente. Agora essas contas aparecem com o selo **Administrador**, ficam fora dos contadores de clientes e têm o menu «Conta da equipa — protegida».

- **Eliminar conta…**: o servidor verifica a permissão de administrador e se a conta pode ser eliminada.
  - **Bloqueios** (o motivo é mostrado): conta administrativa ou a do próprio administrador; facturas, pagamentos, encomendas, serviços, hospedagem (cPanel), conta WHM associada, domínios, caixas de e-mail ou tickets.
  - Com dependências, a alternativa é **Suspender acesso ao portal**. É reversível: termina as sessões e impede o login, sem tocar em facturas, serviços nem WHM.
  - **Sem dependências**: escrever o e-mail exacto e confirmar. Na mesma transacção, com o perfil bloqueado, são removidas a autenticação, o perfil, as sessões e os tokens. O registo vai para `activity_logs`.
- **Nunca** é chamada a API do WHM. Nenhuma conta cPanel é removida ou suspensa.
- Coluna de estado: «Ativo», «Acesso suspenso» ou «Suspenso WHM», e, separado, «E-mail verificado» ou «E-mail por verificar». Novo filtro «E-mail por verificar».

## 3. Migração
`20261124_08_auth_email_and_deletion.sql` cria a tabela `auth_email_log`. Só acrescenta; não altera contas existentes.
