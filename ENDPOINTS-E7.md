# Endpoints do E7: Mercado e logística — Etapa A

API do backend (NestJS + Prisma + PostgreSQL). Base local: `http://localhost:3000` (ou `PORT`). Este documento descreve a Etapa A. Edição, indicadores e logística foram acrescentados no [complemento MVP](ENDPOINTS-E7-MVP.md). CSV permanece pendente.

Rotas marcadas com 🔒 precisam do header:

```
Authorization: Bearer <access_token>
```

O token vem de `POST /auth/login`; consulte [ENDPOINTS-E2.md](ENDPOINTS-E2.md). 🛡️ exige também **ADMIN**. Use `Content-Type: application/json` nos POST.

## Resumo

| Método | Rota | Acesso | O que faz |
|--------|------|--------|-----------|
| POST | `/mercado` | 🔒🛡️ | Cadastra valor de mercado |
| GET | `/mercado` | 🔒 | Lista paginada e filtrada |
| POST | `/mercado/atualizar` | 🔒 | Consulta fontes ativas e grava por país/mês |
| GET | `/mercado/cotacao?cultura_id=1` | 🔒 | Último dado gravado por país e conversão PTAX |
| GET | `/mercado/fontes` | 🔒 | Fontes registradas, ativação e diagnósticos |
| GET | `/mercado/:id` | 🔒 | Detalhe de um registro |

Rotas fixas existentes são declaradas antes de `/:id`. `/mercado/importar` ainda não existe: será acrescentada antes de `/:id` na Etapa B.

---

## Cadastro e consulta

### POST `/mercado` 🔒🛡️

**Body**

```json
{
  "cultura_id": 1,
  "mercado_destino": "Argentina",
  "pais_destino": "Argentina",
  "preco": "2.35",
  "moeda": "usd",
  "unidade_medida": "kg",
  "data_referencia": "2026-08-01",
  "demanda_estimada": 1000
}
```

`demanda_estimada` é opcional e deve ser >= 0. Preço deve ser positivo; aceita string decimal com ponto (recomendado) ou número JSON. Moeda: três letras, normalizada para maiúsculas. Textos obrigatórios são aparados e não podem ser vazios. A cultura deve existir.

**Resposta 201**

```json
{
  "id": 1,
  "cultura_id": 1,
  "mercado_destino": "Argentina",
  "pais_destino": "Argentina",
  "preco": "2.35",
  "moeda": "USD",
  "unidade_medida": "kg",
  "data_referencia": "2026-08-01T00:00:00.000Z",
  "demanda_estimada": 1000,
  "cultura": { "id": 1, "nome": "Manga" }
}
```

**Erros**

- `400`: body inválido, campo extra ou referência inválida (Prisma P2003).
- `401`: token ausente ou inválido.
- `403`: usuário COMUM.
- `404`: cultura inexistente; P2025 convertido em mensagem de recurso não encontrado.
- `409`: chave lógica já cadastrada ou Prisma P2002.
- `503`: armazenamento indisponível, sem expor mensagem interna.

A chave lógica é `(cultura_id, mercado_destino, data_referencia)`; cadastro manual não sobrescreve. A verificação é em transação, mas sem constraint única não garante exclusão de duplicatas entre transações concorrentes de instâncias diferentes. Não houve alteração de schema.

### GET `/mercado` 🔒

**Query opcional**

- `cultura_id`: inteiro positivo.
- `mercado_destino`: busca parcial sem diferenciar maiúsculas.
- `data_inicio`, `data_fim`: datas ISO; início <= fim. Data final sem horário inclui todo o dia em UTC.
- `page`: padrão 1; `limit`: padrão 20, máximo 100.

Exemplo:

```http
GET /mercado?cultura_id=1&mercado_destino=arg&data_inicio=2026-01-01&data_fim=2026-12-31&page=1&limit=20
```

**Resposta 200**

```json
{
  "data": [
    {
      "id": 1,
      "cultura_id": 1,
      "mercado_destino": "Argentina",
      "pais_destino": "Argentina",
      "preco": "2.35",
      "moeda": "USD",
      "unidade_medida": "kg",
      "data_referencia": "2026-08-01T00:00:00.000Z",
      "demanda_estimada": 1000,
      "cultura": { "id": 1, "nome": "Manga" }
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 1, "totalPages": 1 }
}
```

Ordenação: data de referência decrescente e id decrescente para desempate. Sem resultados: `data: []`, `total: 0`, `totalPages: 0`. Filtros inválidos e intervalo invertido: `400`.

### GET `/mercado/:id` 🔒

Sem body. **Resposta 200** igual ao registro do cadastro, incluindo `cultura`. `404` se não existir; `400` se id não for inteiro.

---

## Valor médio de exportação e câmbio

### POST `/mercado/atualizar` 🔒

Qualquer usuário autenticado. **Body**

```json
{ "cultura_id": 1, "fonte": "comexstat", "forcar": false }
```

`fonte` é opcional; sem ela consulta todas as ativas que suportam a cultura. `forcar` é booleano, padrão false; true exige ADMIN e ignora TTL. Não aceita strings `"true"` ou `"false"`. Não ignora `Retry-After` nem cria consulta paralela se já existir atualização em andamento.

**Resposta 200** (exemplo ilustrativo)

```json
{
  "cultura": { "id": 1, "nome": "Manga" },
  "fontes": [
    {
      "id": "comexstat",
      "status": "atualizada",
      "atualizado_em": "2026-10-11T15:00:00.000Z",
      "registros_gravados": 35
    }
  ],
  "cambio": { "usd_brl": 4.9892, "data": "2026-10-09 13:07:30.746597", "fonte": "BCB PTAX" },
  "desatualizado": false,
  "fonte_erro": null
}
```

Status por fonte: `atualizada`, `cache`, `erro`. Cache/deduplicação retorna `registros_gravados: 0` e preserva horário da atualização. `registros_gravados` conta inseridos + atualizados nesta chamada. Uma resposta válida sem movimentos retorna `0`, sem fabricar dados. Cada fonte grava o lote em transação: atualiza preço, demanda e metadados se a chave lógica existir; senão insere. O cache só fica pronto após a gravação.

Falha com dados antigos: **200** com fontes de status `erro`, campo `erro`, `desatualizado: true`, `fonte_erro` e `data` contendo o último registro armazenado por país. Sem dados antigos: **502**, mensagem `Não foi possível obter cotação e não há dados armazenados`. PTAX indisponível não bloqueia a atualização: `cambio: null`.

**Erros**

- `400`: cultura sem mapeamento (`Cultura sem fonte de cotação configurada`), fonte desconhecida/inativa ou body inválido.
- `403`: COMUM tentando `forcar: true`.
- `404`: cultura inexistente.
- `502`: todas as fontes falharam e nenhum dado está armazenado.

Não é cotação de bolsa. O Comex Stat fornece **valor médio de exportação**, FOB/peso em USD/kg, mensal por país. Peso exportado é proxy de demanda. Configuração e limitações: [README](backend/README.md#e7--mercado-etapa-a).

### GET `/mercado/cotacao?cultura_id=1` 🔒

`cultura_id` obrigatório. Lê o mês/instante mais recente **gravado** por país; não chama Comex Stat nem grava. Usa PTAX em cache para conversão na hora. Para renovar mercado, use o POST acima.

**Resposta 200**

```json
{
  "cultura": { "id": 1, "nome": "Manga" },
  "cambio": { "usd_brl": 4.9892, "data": "2026-10-09 13:07:30.746597", "fonte": "BCB PTAX" },
  "atualizado_em": "2026-10-11T15:00:00.000Z",
  "desatualizado": false,
  "fonte_erro": null,
  "data": [
    {
      "id": 1,
      "cultura_id": 1,
      "mercado_destino": "Argentina",
      "pais_destino": "Argentina",
      "preco": "2.35",
      "moeda": "USD",
      "unidade_medida": "kg",
      "data_referencia": "2026-08-01T00:00:00.000Z",
      "demanda_estimada": 1000,
      "cultura": { "id": 1, "nome": "Manga" },
      "preco_usd": "2.35",
      "preco_brl": "11.72462",
      "atualizado_em": "2026-10-11T15:00:00.000Z",
      "desatualizado": false,
      "fonte_erro": null
    }
  ]
}
```

Preços sempre strings. Taxa PTAX é número; data PTAX é o horário de Brasília informado pelo BCB. `preco_brl: null` se PTAX indisponível ou moeda diferente de USD; `preco_usd: null` para outras moedas. Não altera moeda/preço armazenados. Sem registros: `data: []`. `400` para query inválida; `404` para cultura inexistente.

Sem coluna de atualização ou fonte, os metadados são por cultura e em memória. Após reinício: `atualizado_em: null`, `desatualizado: true`. TTL vencido/erro também marca desatualizado; não é uma garantia de movimento recente para cada país ou de origem dos registros manuais.

### GET `/mercado/fontes` 🔒

Sem body. **Resposta 200**

```json
[
  {
    "id": "comexstat",
    "nome": "Comex Stat (MDIC) — valor médio de exportação",
    "ativa": true,
    "ultima_atualizacao": null,
    "ultimo_erro": null
  }
]
```

Lista fontes registradas, incluindo desativadas. Horários e erros são diagnósticos em memória. Para desligar: `MERCADO_FONTES_ATIVAS=""` e reiniciar. A listagem de registros gravados continua disponível.

---

## Roteiro no Thunder Client/Postman

1. No terminal dentro de `backend/`, abra manualmente `npx prisma studio`. Não execute seed, reset, db push nem migration. Na tabela **Cultura**, use Add record, preencha apenas `nome: Manga` (ou `Uva fresca`), deixe id automático e campos opcionais vazios, salve e anote o id. Não há endpoint de cadastro de Cultura nesta etapa.
2. Inicie a API com `npm run start:dev` em `backend/`. Use configuração já existente; não há dependência nova. As fontes podem ser configuradas manualmente seguindo `.env.example`.
3. `POST /auth/login`, body `{ "email": "<email existente>", "senha": "<senha existente>" }`. Salve `accessToken` como variável e use Bearer nas próximas requests. Use ADMIN existente para cadastro manual; não altere usuários diretamente para contornar autenticação.
4. `GET /mercado/fontes` → 200 e diagnóstico inicial.
5. `POST /mercado` com o body acima, substituindo `cultura_id`. → 201. Anote id. Repita → 409. Com cultura inexistente → 404. COMUM → 403.
6. `GET /mercado?cultura_id=<id>&mercado_destino=arg&data_inicio=2026-01-01&data_fim=2026-12-31&page=1&limit=20` → 200. Inverta as datas → 400.
7. `GET /mercado/<id-do-registro>` → 200; id inexistente → 404.
8. `POST /mercado/atualizar`, body `{ "cultura_id": <id> }` → 200, `atualizada` (ou fallback/502 se fonte indisponível). **Essa chamada grava dados reais no banco compartilhado**; execute-a quando desejar esses registros.
9. Repita a atualização dentro de 60 minutos → `cache`, 0 registros gravados. Com ADMIN, `{ "cultura_id": <id>, "forcar": true }` → consulta novamente. Com COMUM → 403.
10. `GET /mercado/cotacao?cultura_id=<id>` → últimos registros por país, USD/BRL (ou BRL null). `GET /mercado/fontes` → horários e erros conhecidos.
11. Para testar fonte desligada, configure manualmente `MERCADO_FONTES_ATIVAS=""`, reinicie, confira `ativa: false`; dados gravados continuam listáveis. Não precisa desligar internet para testar falhas: a suíte unitária já usa fixtures de 429, timeout, dados inválidos e indisponibilidade.

Empresa e Colheita **não são necessárias para Etapa A**. Quando chegarmos à logística, registros de teste via Studio exigirão a sequência: Empresa (razao_social, cpf_cnpj único, tipo, status) → Propriedade (empresa_id, nome, municipio, estado, area_total, status) → Talhao (propriedade_id, nome, area, status) → Talhao_Cultura (talhao_id, cultura_id, data_plantio, status) → Colheita (talhao_cultura_id, status). Anote `empresa_id` e `colheita_id`. Não criamos esses registros nem decidimos nesta etapa como a API logística receberá as FKs.

## Resumo por arquivo e verificação

- `backend/src/app.module.ts`: registro do MercadoModule (já estava alterado na chegada).
- `backend/src/mercado/mercado.module.ts`: providers e descoberta de fontes locais.
- `mercado.controller.ts`: JWT/roles existentes; ordem de rotas; ADMIN no cadastro e no force.
- `mercado.service.ts`: cadastro, filtros, paginação, detalhe, transações, serialização Decimal, fallback e cotação.
- `dto/create-valor-mercado.dto.ts`, `list-valor-mercado.dto.ts`, `atualizar-mercado.dto.ts`, `cotacao-mercado.dto.ts`: validação/normalização.
- `fontes/fonte-mercado.interface.ts`: contratos de fontes e registros.
- `fontes/culturas-ncm.config.ts`: mapa versionado e normalização de cultura.
- `fontes/comexstat.fonte.ts`: consulta limitada e validação do contrato real; cálculo por país/mês.
- `fontes/http-seguro.service.ts`: timeout/retry, allowlist, redirects, limite de corpo e Retry-After.
- `fontes/mercado-fontes.service.ts`: ativação, TTL, deduplicação com persistência e diagnóstico.
- `fontes/ptax.service.ts`: fechamento mais recente, cache e fallback null.
- `mercado.spec.ts`, `fontes/fontes.spec.ts`: testes com Prisma/fetch mockados.
- `backend/.env.example`, `backend/README.md`, `README.md`, `ENDPOINTS-E7.md`: configuração, decisões, limitações e roteiro.

Decisões de implementação: preços em strings; preço manual duplicado responde 409; conversão PTAX venda; período de meses completos; BA=32 conforme API; fontes locais descobertas automaticamente; cache inclui transação; atualização em memória conservadora após restart. Nenhuma dependência foi adicionada.

Verificado por leitura pública: documentação e contrato real Comex Stat, estados PE/BA, NCM uva e uma consulta mensal; PTAX de fechamento em janela com fim de semana. Não verificado: integração HTTP completa com JWT e gravação real no PostgreSQL compartilhado, limites/429 reais sob carga ou disponibilidade futura das fontes. Esses cenários são exercitados com mocks quando aplicável. Não houve acesso de teste à internet ou ao banco, alteração de schema, `.env` real, front-end ou módulos proibidos.

Validação final da Etapa A: `npm run build` aprovado; `npm run lint` aprovado sem avisos; `npm test` aprovado (**100 testes, 12 arquivos**). Importação do módulo compilado confirmou a descoberta de `ComexstatFonte`, sem iniciar a aplicação ou conectar ao banco. O Vitest emite um aviso preexistente sobre `vite-tsconfig-paths`; nenhuma configuração fora do escopo foi alterada.

## Coleção para testes manuais

Importe [docs/E7.postman_collection.json](docs/E7.postman_collection.json) em **Import** no Postman ou pela opção de importar coleção Postman do Thunder Client. Formato Postman v2.1, com 25 requests em cinco pastas; execute na ordem. Preencha `baseUrl` (padrão `http://localhost:3001`, ajuste à porta da API), `adminEmail`, `adminSenha`, `comumEmail`, `comumSenha` e `culturaId` com o id de Manga ou Uva fresca. Os usuários precisam existir e estar ATIVOS. Não exporte credenciais preenchidas para o repositório.

No Postman, os scripts salvam `accessToken` dos logins em `token`/`tokenComum`, salvam o id do cadastro em `mercadoId` e verificam os status. Se o Thunder Client não executar os scripts `pm.*`, copie manualmente `accessToken` de cada login para a variável correspondente e `id` do cadastro para `mercadoId`; confira status e corpo manualmente. Cada request já indica o token adequado; a request sem token usa `noauth`.

Para obter os ids, execute você mesma o seed de demonstração conforme o [README do backend](backend/README.md#dados-de-demonstração-para-testes-manuais-do-e7). O seed não cria usuários. Cadastro manual `[201]` pressupõe chave ainda inexistente; em nova rodada altere a mesma `data_referencia` no cadastro e na repetição `[409]`. Confirme no Studio que Cultura `9999` não existe antes de enviar esse teste negativo. Atualizações dependem da fonte: em falha sem dados podem retornar 502; o teste de cache exige atualização anterior bem-sucedida, TTL vigente e nenhuma reinicialização. Os POST da coleção gravam dados no banco compartilhado.
