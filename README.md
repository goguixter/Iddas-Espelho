## IDDAS Espelho

Painel desktop-first para espelhar dados do IDDAS localmente, gerar documentos e orquestrar assinaturas pela Clicksign.

Fluxos principais:

1. Sincronização local de orçamentos, pessoas, vendas e solicitações do IDDAS
2. Geração de documentos HTML/PDF a partir dos dados espelhados
3. Envio de contratos para assinatura via Clicksign
4. Recebimento de webhooks da Clicksign com atualização local de status e timeline

## Stack

- Next.js 16
- React 19
- Tailwind CSS 4
- SQLite local com `better-sqlite3`

## Configuração

Crie o arquivo `.env.local` com base em `.env.example`:

```bash
cp .env.example .env.local
```

Variáveis:

- `CLICKSIGN_PROFILE`: perfil ativo da Clicksign (`sandbox` ou `production`)
- `CLICKSIGN_SANDBOX_BASE_URL`: base da API sandbox
- `CLICKSIGN_SANDBOX_API_KEY`: token sandbox
- `CLICKSIGN_SANDBOX_WEBHOOK_SECRET`: segredo HMAC sandbox
- `CLICKSIGN_PRODUCTION_BASE_URL`: base da API de produção
- `CLICKSIGN_PRODUCTION_API_KEY`: token de produção
- `CLICKSIGN_PRODUCTION_WEBHOOK_SECRET`: segredo HMAC de produção
- `CLICKSIGN_CONTRATADA_SIGNER_NAME`: nome padrão da contratada
- `CLICKSIGN_CONTRATADA_SIGNER_EMAIL`: e-mail padrão da contratada
- `CLICKSIGN_CONTRATADA_SIGNER_DOCUMENT`: CPF/CNPJ da contratada
- `CLICKSIGN_CONTRATADA_SIGNER_BIRTH`: data de nascimento padrão da contratada em `AAAA-MM-DD`
- `IDDAS_API_BASE_URL`: base da API
- `IDDAS_TOKEN_ENDPOINT`: endpoint de geração do bearer token
- `IDDAS_ACCESS_KEY`: chave de acesso fornecida pelo IDDAS
- `IDDAS_SYNC_ORCAMENTOS_PER_PAGE`: paginação de orçamentos
- `IDDAS_SYNC_PESSOAS_PER_PAGE`: paginação de pessoas
- `IDDAS_SYNC_VENDAS_PER_PAGE`: paginação de vendas
- `AUTH_SECRET`: segredo usado para assinar a sessão do login
- `AUTH_USERNAME`: usuário do painel
- `AUTH_PASSWORD`: senha do painel

## Desenvolvimento

```bash
npm run dev
```

Abra `http://localhost:3000`.

Com autenticação configurada, o acesso ao painel e às rotas `/api/*` exige login em `/login`.
As exceções públicas continuam sendo:

- `POST /api/clicksign/webhook`
- `POST /api/iddas/webhook`

Para validar automaticamente essa proteção antes do deploy:

```bash
npm run test:auth
```

Esse smoke test faz build, sobe a aplicação localmente com credenciais de teste e verifica:

- páginas protegidas redirecionando para `/login`
- APIs protegidas retornando `401`
- webhooks públicos sem exigência de autenticação
- fluxo de login emitindo cookie de sessão válido

Para validar webhooks localmente com Clicksign, exponha a aplicação com `ngrok`:

```bash
ngrok http 3000
```

Cadastre no Clicksign a URL pública terminando em `/api/clicksign/webhook`.

Para alternar entre sandbox e produção sem trocar todas as credenciais, mude apenas:

```bash
CLICKSIGN_PROFILE=sandbox
```

ou

```bash
CLICKSIGN_PROFILE=production
```

Depois de trocar o perfil, reinicie o servidor.

## Operação

Checklist para validar o ambiente ativo da Clicksign:

1. conferir `CLICKSIGN_PROFILE` no `.env.local`
2. reiniciar o servidor
3. enviar um contrato de teste
4. confirmar no log `document.clicksign.notification-payload` o `profile`
5. confirmar em qual conta da Clicksign o envelope apareceu

Sobre notificações por e-mail:

- o servidor só precisa estar ligado para criar envelope, ativar o fluxo e disparar a notificação
- depois que a Clicksign aceita a notificação, a entrega do e-mail não depende mais do seu servidor
- os webhooks continuam dependendo da sua URL pública responder

## Rotas internas

- `GET /api/orcamentos?page=1&per_page=10`
- `GET /api/pessoas?page=1&per_page=10`
- `GET /api/vendas?page=1&per_page=10`
- `GET /api/sync`
- `POST /api/sync`
- `POST /api/documentos/:id/clicksign`
- `POST /api/clicksign/webhook`

## Observação importante

A documentação pública do IDDAS não expõe claramente o endpoint nem o formato exato da emissão do bearer token. O projeto já deixa isso parametrizado por ambiente e tenta mapear respostas comuns (`token`, `access_token`, `data.token`). Se a sua conta usar um endpoint ou payload diferente, ajuste `IDDAS_TOKEN_ENDPOINT` e, se necessário, a função `getBearerToken` em [lib/iddas/client.ts](/Users/cdmjeferson/iddas_espelho/lib/iddas/client.ts).
