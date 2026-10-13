# SIVALE — Sistema Inteligente do Vale

Projeto Integrador (UE Mobile · Senac Pernambuco): plataforma web em nuvem para monitoramento climático e logístico da fruticultura (manga e uva) do Vale do São Francisco. Este repositório cobre a **1ª entrega (13/10/2026)**: PWA + Backend + Banco de Dados, com o fluxo completo `sensor → API → banco → dashboard`.

## Estrutura

```
sivale/
├── api/        API NestJS + Prisma + PostgreSQL (Swagger em /docs)
├── frontend/   PWA React + Vite + TypeScript (mapa, painéis, cadastros)
├── backend/    MVP antigo em Express + SQLite (legado; não é mais usado)
└── docs/       Arquitetura, modelo do banco (ER), endpoints e roteiro da demo
```

## Como rodar (local)

Requisitos: Node.js 22 ou superior e npm.

### 1. Banco de dados PostgreSQL

Escolha uma opção:

```bash
cd api
npm install
cp .env.example .env     # no Windows: copy .env.example .env
npm run db:dev           # Postgres embutido em localhost:5433 (sem Docker); deixe rodando
```

ou, com Docker: `docker compose up -d db` (também em `localhost:5433`). Para usar outro Postgres, ajuste `DATABASE_URL` no `.env`.

### 2. API

Em outro terminal, dentro de `api/`:

```bash
npx prisma migrate deploy   # cria as tabelas
npx prisma db seed          # dados de exemplo (4 perfis, 2 propriedades, culturas, talhões, dispositivos, histórico)
npm run build
npm run start:prod          # http://localhost:3333  ·  documentação em /docs
```

Para desenvolver com recarga automática, use `npm run start:dev` no lugar do build e start.

### 3. Frontend

```bash
cd frontend
npm install
cp .env.example .env        # VITE_API_URL=http://localhost:3333
npm run dev                 # http://localhost:5173
```

### 4. Simulador de sensores (substitui o ESP32)

Com a API no ar, em `api/`:

```bash
npm run simulate            # uma rodada de leituras
npm run simulate -- loop    # uma rodada a cada 30 s (10 % das leituras saem da faixa para gerar alertas)
```

Cada dispositivo se autentica com a própria chave (`x-device-key`); o simulador gera uma chave nova por execução.

### Contas de teste

Senha `123456` para todas: `admin@sivale.com.br` (Administrador), `gestor@sivale.com.br` (Gestor), `tecnico@sivale.com.br` (Técnico), `carlos@sivale.com.br` (Agricultor). Só o Administrador cadastra e edita; os demais consultam e tratam alertas ([perfis e telas](docs/PERFIS_E_TELAS.md)). Troque a senha e o `JWT_SECRET` fora do ambiente de desenvolvimento.

## Verificação

```bash
cd api && npm run smoke       # com a API no ar: 90+ verificações de fluxo, perfis, escopo, regras e dashboards
cd api && npm run build       # compila a API
cd frontend && npm run build  # compila o PWA
```

No Windows, o runner localiza automaticamente o Git Bash instalado pelo Git for Windows.

## Funcionalidades (requisitos da 1ª entrega)

| Req. | Entrega |
|---|---|
| 1–2 | Cadastro de usuários (só administrador), login JWT, rotas protegidas, 4 perfis, escopo por empresa e propriedade, Meu perfil |
| 3–7 | Empresas/produtores, propriedades (latitude e longitude), culturas, talhões, dispositivos e sensores |
| 8–9 | Ingestão `POST /ingest/medicoes` com chave de dispositivo, consulta paginada e filtros por período |
| 10–11 | Valores de mercado (cadastro manual ou botão **Atualizar valores**) e informações logísticas |
| 12–13 | Mapa de satélite, painéis T1, T2 e P2, e tela de Histórico com filtros (propriedade, talhão, cultura, dispositivo e período) |
| 14 | Alertas automáticos por faixa da cultura, sem repetição, com resolução; falha de sensor |
| 15–16 | Fluxo integrado e documentação em [`docs/`](docs/) |

## Documentação

- [Perfis de acesso e telas](docs/PERFIS_E_TELAS.md): matriz de acesso por perfil
- [Arquitetura](docs/ARQUITETURA.md): fluxo, componentes, segurança, regras de negócio e proposta multicloud da 2ª entrega
- [Modelo do banco (ER)](docs/MODELO_BANCO.md)
- [Endpoints](docs/ENDPOINTS.md) (e Swagger em `http://localhost:3333/docs`)
- [Roteiro da demo e checklist de testes](docs/DEMO.md)

## Tecnologias

NestJS 12 · Prisma 7 · PostgreSQL · JWT + bcrypt · class-validator · Swagger · React 18 · Vite · TypeScript · Leaflet · Recharts · PWA (manifest + service worker).

## Variáveis de ambiente da API

| Variável | Padrão | Uso |
|---|---|---|
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5433/sivale` | Conexão com o PostgreSQL |
| `JWT_SECRET` / `JWT_EXPIRES_IN` | — / `8h` | Assinatura e validade do token |
| `PORT` / `CORS_ORIGIN` | `3333` / `http://localhost:5173` | Porta e origens permitidas |
| `MERCADO_FONTE_URL` | `./data/mercado-exemplo.json` | Fonte do botão "Atualizar valores" (URL http(s) ou arquivo JSON; o arquivo de exemplo tem valores ilustrativos) |
| `ALERTA_JANELA_MIN` | `60` | Janela sem repetir o mesmo alerta |
| `LIMITE_SEM_COMUNICACAO_MIN` | `30` | Minutos sem leitura para considerar falha de sensor |
| `ALERTA_VERIFICAR_COMUNICACAO_MIN` | `5` | Frequência da verificação (0 desliga) |
| `PESO_ALERTA_CRITICO` / `PESO_ALERTA_ATENCAO` | `5` / `2` | Pesos do score de prioridade (P2) |
| `THINGSPEAK_*` | — | Integração opcional com ThingSpeak |

## Próximos passos (2ª entrega · 08/12/2026)

Deploy em nuvem com Terraform (proposta AWS + Azure em [`docs/ARQUITETURA.md`](docs/ARQUITETURA.md)), pipeline e análise de dados em Python (janela de colheita e exportação), dashboards T3, P1, P3 e P4 (exigem a entidade `Colheita`), testes automatizados, monitoramento e relatório de segurança.
