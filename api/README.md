# SIVALE API

API REST em NestJS + Prisma + PostgreSQL. Instruções completas de execução no [README da raiz](../README.md).

```bash
npm install && cp .env.example .env
npm run db:dev                       # Postgres local (outro terminal)
npx prisma migrate deploy && npx prisma db seed
npm run start:dev                    # http://localhost:3333  ·  Swagger em /docs
npm run simulate -- loop             # simulador de sensores
npm run smoke                        # testes de fluxo contra a API no ar
```

## Estrutura

```
src/
├── common/        decoradores, guards (JWT, perfis), escopo por propriedade, config e chave de dispositivo
├── auth/ usuarios/ empresas/ propriedades/ culturas/ talhoes/
├── dispositivos/ sensores/ medicoes/ (inclui /ingest)   alertas/
├── dashboard/ mercado/ logistica/ thingspeak/
└── prisma/        conexão com o banco
prisma/            schema, migrations e seed
scripts/           simulador, banco local e smoke.sh
```

Cada módulo concentra DTOs, serviço e controller (os menores ficam em um arquivo só). As regras de acesso ficam em `common/acesso.service.ts`.
