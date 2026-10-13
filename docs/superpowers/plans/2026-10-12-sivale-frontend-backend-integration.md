# SiVale Frontend-Backend Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidar o frontend React e as regras do backend NestJS baixado em uma única API funcional em `sivale/api`, preservando o contrato público em português e removendo o backend legado somente após validação ponta a ponta.

**Architecture:** `frontend` consumirá HTTP/JSON com JWT por `src/api.ts`; `api` será a única aplicação NestJS e persistirá em PostgreSQL via Prisma. Regras e testes do backend baixado serão incorporados por domínio, sem copiar seu contrato em inglês nem entidades ainda sem fluxo de interface.

**Tech Stack:** React 18, TypeScript 5, Vite 5, NestJS 12, Prisma 7, PostgreSQL, JWT, bcryptjs, class-validator, Vitest, Supertest.

**Spec:** `docs/superpowers/specs/2026-10-12-sivale-frontend-backend-integration-design.md`

## Global Constraints

- `sivale/api` é o único backend oficial; preservar as rotas em português de `frontend/src/api.ts`.
- Preservar `ADMINISTRADOR`, `GESTOR`, `TECNICO` e `AGRICULTOR`; autorização obrigatória no backend.
- Nunca expor senha, hash, token ou chave de dispositivo.
- Não implementar recomendação de colheita/exportação sem fluxo aprovado.
- Usar TDD e não remover `sivale/backend` antes de todos os gates finais.
- `sivale` não possui `.git`; commits são condicionais a futura inicialização autorizada.

## Review Focus

- Token revogado/expirado: API responde `401` e frontend limpa sessão (Tasks 2 e 8).
- Usuário sem vínculo não enumera recursos alheios (Tasks 3 e 4).
- Dispositivo inativo, chave inválida ou leitura implausível não persiste dados (Task 5).
- Falha da fonte externa de mercado preserva registros existentes (Task 7).
- Resposta vazia, não-JSON ou falha de rede encerra loading e apresenta erro (Task 8).

---

### Task 1: Baseline e contrato HTTP

**Files:**
- Create: `api/test/helpers/app.ts`
- Create: `api/test/contract/auth.e2e-spec.ts`
- Create: `api/test/contract/catalogos.e2e-spec.ts`
- Create: `api/test/contract/operacao.e2e-spec.ts`
- Modify: `api/test/app.e2e-spec.ts`
- Modify: `api/vitest.config.e2e.ts`

**Interfaces:**
- Consumes: `AppModule`, `configurar(app)` e `prisma/seed.ts`.
- Produces: `createTestApp(): Promise<INestApplication>`, `loginAs(app,email): Promise<Record<string,string>>` e contrato para todas as chamadas de `frontend/src/api.ts`.

- [ ] Criar os helpers de inicialização, encerramento e autenticação do app de teste.
- [ ] Escrever testes falhos de status e forma mínima das respostas para autenticação, cadastros e operação; `/users`, `/devices`, `/readings` e `/alerts` devem retornar `404`.
- [ ] Run: `cd C:\Users\tiago\Documents\sivale\api; npm run test:e2e`. Expected: falhas determinísticas apenas nos contratos ainda divergentes.
- [ ] Corrigir somente lifecycle/configuração do teste, sem mudar regra de negócio.
- [ ] Reexecutar `npm run test:e2e`; registrar as falhas restantes como baseline das Tasks 2–7.
- [ ] Se houver Git: commit `test: freeze frontend api contract`.

### Task 2: Sessões revogáveis

**Files:**
- Modify: `api/prisma/schema.prisma`
- Create: `api/prisma/migrations/<timestamp>_add_token_version_and_audit/migration.sql`
- Modify: `api/src/auth/auth.service.ts`
- Modify: `api/src/auth/auth.controller.ts`
- Modify: `api/src/common/guards.ts`
- Create: `api/src/auth/auth.service.spec.ts`
- Modify: `api/test/contract/auth.e2e-spec.ts`

**Interfaces:**
- Consumes: `/auth/login`, `/auth/me`, `usuario.id` e `usuario.perfil`.
- Produces: `/auth/logout`, JWT `{sub,perfil,tokenVersion}` e `validarSessao(payload): Promise<UsuarioLogado>`.

- [ ] Escrever testes falhos: credencial inválida, campos desconhecidos, resposta sem segredo, logout incrementa versão e token anterior vira `401`.
- [ ] Run: `cd ...\sivale\api; npx vitest run src/auth/auth.service.spec.ts`. Expected: FAIL por falta de revogação.
- [ ] Adicionar `tokenVersion Int @default(0)` e `auditLog` com usuário opcional, ação, recurso, recursoId, IP, antes/depois e timestamp; gerar migração.
- [ ] Assinar/comparar `tokenVersion`; implementar logout autenticado retornando `204`.
- [ ] Run: `npx vitest run src/auth/auth.service.spec.ts; npm run test:e2e -- auth.e2e-spec.ts`. Expected: PASS.
- [ ] Se houver Git: commit `feat: add revocable sessions`.

### Task 3: Perfis e vínculos

**Files:**
- Modify: `api/src/common/acesso.service.ts`
- Modify: `api/src/common/decorators.ts`
- Modify: `api/src/common/guards.ts`
- Modify: `api/src/usuarios/usuarios.dto.ts`
- Modify: `api/src/usuarios/usuarios.service.ts`
- Modify: `api/src/usuarios/usuarios.controller.ts`
- Create: `api/src/usuarios/usuarios.service.spec.ts`
- Modify: `api/test/contract/catalogos.e2e-spec.ts`

**Interfaces:**
- Consumes: `UsuarioLogado {id,perfil}`, `usuarioEmpresa`, `usuarioPropriedade`.
- Produces: `escopoDoUsuario(usuario): Promise<{empresaIds:number[];propriedadeIds:number[];acessoGlobal:boolean}>` e vínculos idempotentes.

- [ ] Escrever testes falhos para admin global, gestor por empresa, técnico/agricultor por propriedade, duplicidade `409`, lista vazia sem vínculo e recurso alheio `404`.
- [ ] Run: `npx vitest run src/usuarios/usuarios.service.spec.ts`. Expected: FAIL nos casos novos.
- [ ] Centralizar o escopo no `AcessoService`; remover consultas duplicadas de autorização.
- [ ] Validar IDs/estado/perfil e auditar criação, alteração e vínculo sem segredos.
- [ ] Run: `npx vitest run src/usuarios/usuarios.service.spec.ts; npm run test:e2e -- catalogos.e2e-spec.ts`. Expected: PASS.
- [ ] Se houver Git: commit `feat: enforce user access scopes`.

### Task 4: Empresas, propriedades, culturas e talhões

**Files:**
- Modify: `api/src/empresas/empresas.ts`
- Modify: `api/src/propriedades/propriedades.dto.ts`
- Modify: `api/src/propriedades/propriedades.service.ts`
- Modify: `api/src/propriedades/propriedades.controller.ts`
- Modify: `api/src/culturas/culturas.ts`
- Modify: `api/src/talhoes/talhoes.ts`
- Create: `api/src/talhoes/talhoes.spec.ts`
- Modify: `api/test/contract/catalogos.e2e-spec.ts`

**Interfaces:**
- Consumes: `AcessoService.escopoDoUsuario()`.
- Produces: CRUD escopado e regra `soma(area dos talhões ativos) <= propriedade.areaTotal`.

- [ ] Escrever testes falhos para escopo, CPF/CNPJ duplicado, cultura inválida, propriedade alheia, área excedida `400` e datas ISO.
- [ ] Run: `npx vitest run src/talhoes/talhoes.spec.ts`. Expected: FAIL nas regras novas.
- [ ] Aplicar DTOs `class-validator` e escopo antes de toda consulta/alteração.
- [ ] Implementar a validação transacional de área dos talhões.
- [ ] Run: `npx vitest run src/talhoes/talhoes.spec.ts; npm run test:e2e -- catalogos.e2e-spec.ts`. Expected: PASS.
- [ ] Se houver Git: commit `feat: consolidate scoped catalogs`.

### Task 5: IoT, medições e alertas

**Files:**
- Modify: `api/src/dispositivos/dispositivos.ts`
- Modify: `api/src/sensores/sensores.ts`
- Modify: `api/src/medicoes/medicoes.ts`
- Modify: `api/src/alertas/alertas.ts`
- Create: `api/src/medicoes/medicoes.spec.ts`
- Create: `api/src/alertas/alertas.spec.ts`
- Modify: `api/test/contract/operacao.e2e-spec.ts`
- Modify: `api/scripts/simulate.ts`

**Interfaces:**
- Consumes: talhão/cultura escopados e `x-device-key` de dispositivo ativo.
- Produces: `registrarLeitura(dispositivoId,dto): Promise<medicao>`, alertas deduplicados por `ALERTA_JANELA_MIN` e consultas paginadas.

- [ ] Escrever testes falhos para chave ausente/inválida, dispositivo inativo, valores implausíveis, ausência de persistência após rejeição e leitura válida.
- [ ] Escrever testes falhos para alerta fora/dentro da faixa, deduplicação, visualização, resolução e falta de comunicação.
- [ ] Run: `npx vitest run src/medicoes/medicoes.spec.ts src/alertas/alertas.spec.ts`. Expected: FAIL.
- [ ] Portar regras do backend baixado, mantendo rotas/modelos oficiais e medição conjunta por dispositivo.
- [ ] Atualizar simulador para usar somente `POST /ingest/medicoes` com chave; não criar `POST /medicoes`.
- [ ] Run: testes unitários acima e `npm run test:e2e -- operacao.e2e-spec.ts`. Expected: PASS.
- [ ] Se houver Git: commit `feat: integrate iot readings and alerts`.

### Task 6: Dashboard e histórico reais

**Files:**
- Modify: `api/src/dashboard/dashboard.ts`
- Create: `api/src/dashboard/dashboard.spec.ts`
- Modify: `api/test/contract/operacao.e2e-spec.ts`

**Interfaces:**
- Consumes: medições, alertas, cultura e escopo das Tasks 3–5.
- Produces: resumo, histórico, saúde/alertas por talhão e ranking por propriedade.

- [ ] Escrever testes falhos para contagens, última leitura, médias, séries ordenadas, saúde por faixa, ranking ponderado e conjunto vazio sem `NaN`.
- [ ] Run: `npx vitest run src/dashboard/dashboard.spec.ts`. Expected: FAIL nas divergências.
- [ ] Implementar queries escopadas, datas inclusivas, ordenação estável e `null` quando não houver amostra.
- [ ] Run: teste unitário e `npm run test:e2e -- operacao.e2e-spec.ts`. Expected: PASS com e sem medições.
- [ ] Se houver Git: commit `feat: serve scoped dashboard analytics`.

### Task 7: Mercado e logística resilientes

**Files:**
- Modify: `api/src/mercado/mercado.ts`
- Modify: `api/src/logistica/logistica.ts`
- Create: `api/src/mercado/mercado.spec.ts`
- Create: `api/src/logistica/logistica.spec.ts`
- Modify: `api/test/contract/operacao.e2e-spec.ts`

**Interfaces:**
- Consumes: culturas, propriedades/talhões e escopo.
- Produces: atualização transacional de mercado e CRUD logístico escopado.

- [ ] Escrever testes falhos para timeout, HTTP inválido, JSON inválido, cultura desconhecida, carga válida e preservação dos dados após falha.
- [ ] Escrever testes falhos para propriedade alheia, talhão incompatível, custo negativo, situação inválida e listagem escopada.
- [ ] Run: `npx vitest run src/mercado/mercado.spec.ts src/logistica/logistica.spec.ts`. Expected: FAIL.
- [ ] Validar toda carga externa antes da transação/upsert; aplicar coerência propriedade/talhão na logística.
- [ ] Run: testes unitários e `npm run test:e2e -- operacao.e2e-spec.ts`. Expected: PASS.
- [ ] Se houver Git: commit `feat: harden market and logistics flows`.

### Task 8: Cliente HTTP tipado e estados de interface

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/src/api.ts`
- Create: `frontend/src/api.types.ts`
- Create: `frontend/src/api.test.ts`
- Create: `frontend/src/components/AsyncState.tsx`
- Modify: `frontend/src/pages/Login.tsx`
- Modify: `frontend/src/pages/Dashboard.tsx`
- Modify: `frontend/src/pages/Historico.tsx`
- Modify: `frontend/src/pages/Alertas.tsx`
- Modify: `frontend/src/pages/Empresas.tsx`
- Modify: `frontend/src/pages/Usuarios.tsx`
- Modify: `frontend/src/pages/Propriedades.tsx`
- Modify: `frontend/src/pages/Talhoes.tsx`
- Modify: `frontend/src/pages/Culturas.tsx`
- Modify: `frontend/src/pages/Dispositivos.tsx`
- Modify: `frontend/src/pages/Mercado.tsx`
- Modify: `frontend/src/pages/Logistica.tsx`

**Interfaces:**
- Consumes: contrato estabilizado nas Tasks 1–7.
- Produces: `request<T>(path,options): Promise<T>`, DTOs tipados e `AsyncState` para loading/vazio/erro.

- [ ] Adicionar Vitest/jsdom/Testing Library e scripts `test`/`test:watch`.
- [ ] Escrever testes falhos para query string, Bearer, `204`, `message[]`, corpo não-JSON, rede indisponível e `401` limpando sessão antes do redirecionamento.
- [ ] Run: `cd C:\Users\tiago\Documents\sivale\frontend; npm test`. Expected: FAIL nos casos novos.
- [ ] Criar tipos, remover `any` das APIs públicas e tornar `request<T>` resiliente sem ocultar status HTTP.
- [ ] Adicionar `AsyncState`; garantir `finally`, vazio, erro e feedback de mutações nas telas. Remover controles somente após busca de referências e confirmação de ausência de regra/endpoint.
- [ ] Run: `npm test; npm run build`. Expected: PASS sem erros TypeScript.
- [ ] Se houver Git: commit `feat: connect typed frontend api states`.

### Task 9: Gate final, documentação e legado

**Files:**
- Modify: `api/scripts/smoke.sh`
- Modify: `README.md`
- Modify: `docs/ENDPOINTS.md`
- Modify: `docs/ARQUITETURA.md`
- Modify: `docs/DEMO.md`
- Delete after verification: `backend/**`

**Interfaces:**
- Consumes: aplicação integrada.
- Produces: execução reproduzível, demo verificável e árvore sem backend redundante.

- [ ] Ampliar smoke para quatro perfis, escopo, cadastro, ingestão, histórico, alerta, dashboard, mercado e logística; falha encerra com código não zero.
- [ ] Run API: `npm run lint; npm test; npm run test:e2e; npm run build`. Expected: PASS.
- [ ] Run frontend: `npm test; npm run build`. Expected: PASS.
- [ ] Em PostgreSQL novo, aplicar migrações/seed e observar no navegador o fluxo login -> API -> banco -> dashboard/histórico.
- [ ] Atualizar documentação com comandos, variáveis, contrato, perfis, limitações e somente evidências verificadas.
- [ ] Run: `rg -n "backend/|localhost:3000|sqlite|better-sqlite3" --glob '!backend/**' --glob '!node_modules/**' .`. Expected: nenhuma dependência operacional do Express.
- [ ] Salvar cópia recuperável e remover `backend/` somente após todos os passos anteriores passarem.
- [ ] Repetir builds, e2e e smoke depois da remoção. Expected: PASS.
- [ ] Se houver Git: commit `chore: finalize integrated sivale application`.

## Final Verification Gate

- [ ] API: lint, unitários, contratos/e2e e build passam em ambiente limpo.
- [ ] Frontend: testes e build passam em ambiente limpo.
- [ ] Migrações e seed funcionam em PostgreSQL novo.
- [ ] Fluxo navegador -> API -> banco -> resposta -> tela foi observado.
- [ ] Os quatro perfis foram exercitados sem vazamento entre vínculos.
- [ ] Nenhuma tela mantida depende de mock silencioso ou endpoint inexistente.
- [ ] O Express legado foi removido somente após verificação e com recuperação disponível.
- [ ] Documentação não declara deploy, hardware ou produção como concluídos.
