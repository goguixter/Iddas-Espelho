## Espelho IDDAS

Painel desktop-first para espelhar dados do IDDAS localmente e servir ao seu sistema via rotas internas.

Fluxo implementado:

1. Busca `GET /orcamento?page=1&per_page=10`
2. Para cada item, busca `GET /orcamento/:id`
3. Extrai cliente e passageiros e consulta `GET /pessoa/:id`
4. Busca venda por identificador em `GET /venda?page=1&per_page=100&orcamento=<identificador>`
5. Persiste tudo em SQLite e expõe paginação local para orçamentos, pessoas e vendas

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

- `IDDAS_API_BASE_URL`: base da API
- `IDDAS_TOKEN_ENDPOINT`: endpoint de geração do bearer token
- `IDDAS_ACCESS_KEY`: chave de acesso fornecida pelo IDDAS

## Desenvolvimento

```bash
npm run dev
```

Abra `http://localhost:3000`.

## Rotas internas

- `GET /api/orcamentos?page=1&per_page=10`
- `GET /api/pessoas?page=1&per_page=10`
- `GET /api/vendas?page=1&per_page=10`
- `GET /api/sync`
- `POST /api/sync`

## Observação importante

A documentação pública do IDDAS não expõe claramente o endpoint nem o formato exato da emissão do bearer token. O projeto já deixa isso parametrizado por ambiente e tenta mapear respostas comuns (`token`, `access_token`, `data.token`). Se a sua conta usar um endpoint ou payload diferente, ajuste `IDDAS_TOKEN_ENDPOINT` e, se necessário, a função `getBearerToken` em [lib/iddas/client.ts](/Users/cdmjeferson/iddas_espelho/lib/iddas/client.ts).
