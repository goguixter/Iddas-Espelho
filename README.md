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

- `CLICKSIGN_BASE_URL`: base da API da Clicksign (`sandbox` ou `produção`)
- `CLICKSIGN_API_KEY`: token da conta Clicksign
- `CLICKSIGN_WEBHOOK_SECRET`: segredo HMAC do webhook Clicksign
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

## Desenvolvimento

```bash
npm run dev
```

Abra `http://localhost:3000`.

Para validar webhooks localmente com Clicksign, exponha a aplicação com `ngrok`:

```bash
ngrok http 3000
```

Cadastre no Clicksign a URL pública terminando em `/api/clicksign/webhook`.

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
