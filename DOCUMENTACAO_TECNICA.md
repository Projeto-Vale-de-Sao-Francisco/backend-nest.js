# 📘 Documentação Técnica — ValeVivo Backend (SIVALE)

Esta documentação tem como objetivo orientar os desenvolvedores da equipe sobre a arquitetura do backend, as funcionalidades implementadas dos **Épicos E5, E6 e E9**, os padrões de *Clean Code* adotados e o guia prático para implementação dos próximos épicos do projeto.

---

## 🏗️ 1. Visão Geral da Arquitetura

O projeto foi construído utilizando:
- **Framework:** NestJS (v12) com arquitetura modular e Injeção de Dependências.
- **ORM:** Prisma (v7) com driver de alta performance `@prisma/adapter-pg`.
- **Banco de Dados:** PostgreSQL 18.
- **Testes:** Vitest (execução ultrarrápida com mocks desacoplados).
- **Linter & Formatação:** Oxlint e Prettier.

### Estrutura de Pastas

```text
backend-nest.js/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma        # Modelagem de entidades do banco
│   │   └── seed.ts              # Carga inicial de dados para desenvolvimento
│   ├── src/
│   │   ├── devices/             # [Épico E5] Cadastro e gestão de dispositivos/sensores
│   │   │   ├── dto/             # Contratos de dados de entrada
│   │   │   ├── devices.controller.ts
│   │   │   ├── devices.service.ts
│   │   │   └── devices.module.ts
│   │   ├── readings/            # [Épico E6] Ingestão e consulta de leituras
│   │   │   ├── dto/             # CreateReadingDto
│   │   │   ├── guards/          # ApiKeyGuard (autenticação do simulador/IoT)
│   │   │   ├── readings.controller.ts
│   │   │   ├── readings.service.ts
│   │   │   └── readings.module.ts
│   │   ├── alerts/              # [Épico E9] Regras agronômicas e alertas climáticos
│   │   │   ├── alerts.controller.ts
│   │   │   ├── alerts.service.ts
│   │   │   └── alerts.module.ts
│   │   ├── simulator/           # [Épico E6.4] Script autônomo do simulador IoT
│   │   │   └── simulator.ts
│   │   ├── prisma/              # PrismaService e inicialização do adapter
│   │   ├── thingspeak/          # Integração legada com ThingSpeak
│   │   ├── app.module.ts        # Módulo raiz da aplicação
│   │   └── main.ts              # Ponto de entrada do NestJS
│   ├── package.json
│   └── prisma.config.ts
├── package.json                 # Scripts raiz para execução facilitada
└── requisitos_do_projeto.md     # Documento original de requisitos
```

---

## 🎯 2. Detalhamento dos Épicos Implementados

```mermaid
flowchart LR
    A["Simulador IoT / Hardware"] -->|"POST /readings (x-api-key)"| B["ReadingsModule"]
    B -->|"Validação Física (-50..65°C, 0..100%)"| B
    B -->|"Salva medição"| C[("PostgreSQL (Medicao)")]
    B -->|"Aciona gatilho"| D["AlertsModule"]
    D -->|"Lê limites da cultura do talhão"| E[("PostgreSQL (Cultura)")]
    D -->|"Gera se fora da faixa & sem duplicidade"| F[("PostgreSQL (Alerta)")]
```

---

### 🌿 Épico E5: Sensores IoT Simulados (Requisitos 5.1 a 5.3)

O sistema diferencia **Dispositivo** (hardware físico fixado no talhão) de **Sensor** (componente de telemetria, ex: temperatura/umidade):

1. **Cadastro de Dispositivo e Sensor (`POST /devices` — 5.1):**
   - Valida se o talhão existe no banco.
   - Valida consistência de propriedade caso informada (`propriedadeId === talhao.propriedade_id`).
   - Garante código de hardware único no banco.
   - Cria atomicamente o dispositivo e seu sensor padrão associado (`temperatura_umidade`).
2. **Listagem com Filtros (`GET /devices` — 5.2):**
   - Suporta filtros opcionais via Query Params: `propriedadeId`, `talhaoId` (ou `lote`) e `status`.
   - Carrega as relações de talhão, propriedade e sensores vinculados.
3. **Ativação e Inativação em Cascata (`PATCH /devices/:id/status` — 5.3):**
   - Atualiza o status do dispositivo (`ativo` / `inativo`) e reflete o mesmo status para todos os sensores dependentes dele.

---

### 📡 Épico E6: Leituras e Ingestão de Dados (Requisitos 6.1 a 6.7)

1. **Ingestão com Validação de Integridade (`POST /readings` — 6.1, 6.2, 6.7):**
   - O payload aceita `codigoDispositivo` (ex.: `"ESP32-TALHAO-01"`) ou `sensorId` direto.
   - **Garantia de Sensor Ativo (6.2):** Rejeita leituras caso o dispositivo ou sensor esteja desativado.
   - **Plausibilidade Física (6.2):** Lança `BadRequestException` caso temperatura esteja fora de `[-50°C, 65°C]` ou umidade fora de `[0%, 100%]`.
   - **Métricas adicionais (6.7):** Suporte opcional a `umidadeSolo` (0-100%), `luminosidade` (lux), `precipitacao` (mm) e `pressao`.
2. **Autenticação de Dispositivos/Simulador (`ApiKeyGuard` — 6.6):**
   - Protege a rota `POST /readings` validando o cabeçalho `x-api-key` ou `x-device-token`. A chave padrão é configurada via `DEVICE_API_KEY` no `.env`.
3. **Consulta de Histórico e Última Leitura (6.3 e 6.5):**
   - `GET /readings`: Histórico com filtros por período (`dataInicio`, `dataFim`), sensor, talhão e limite.
   - `GET /readings/latest`: Consulta todos os sensores com sua respectiva medição mais recente.
4. **Simulador Autônomo (`npm run simulator` — 6.4):**
   - Localizado em [`src/simulator/simulator.ts`](file:///c:/Users/aluno/backend-nest.js/backend/src/simulator/simulator.ts).
   - Gera variações contínuas de telemetria a cada 5 segundos e ocasionalmente gera picos térmicos para testar o disparo de alertas.

---

### ⚠️ Épico E9: Alertas Climáticos (Requisitos 9.1 a 9.5)

1. **Gatilho Automático Agronômico (9.1 e 9.2):**
   - Ao receber uma leitura válida, o `AlertsService` busca a cultura ativa plantada naquele talhão (`Talhao -> Talhao_Cultura -> Cultura`).
   - Compara a temperatura e umidade com os campos cadastrados na cultura (`temperatura_min`, `temperatura_max`, `umidade_min`, `umidade_max`).
   - Se os limites forem excedidos, grava um `Alerta` com mensagem em linguagem natural:
     > *"Temperatura de 36.6°C acima do limite máximo (32°C) para o lote de Uva Vitória no Talhão 01 - Lote de Uvas."*
2. **Prevenção de Alertas Repetidos em Sequência (9.5):**
   - O `AlertsService` checa se já existe um alerta ativo do mesmo tipo emitido para aquele mesmo sensor nos últimos **30 minutos**. Isso evita que o operador receba centenas de notificações idênticas seguidas.
3. **Endpoints de Monitoramento e Resolução (9.2, 9.3, 9.4):**
   - `GET /alerts`: Listagem geral com filtros (`status`, `visualizado`, `talhaoId`).
   - `GET /alerts/active`: Alertas pendentes para destaque no painel/dashboard.
   - `PATCH /alerts/:id/view`: Marca como visto (`visualizado: true`).
   - `PATCH /alerts/:id/resolve`: Marca como resolvido (`status: 'resolvido'`).

### 🧑‍🌾 Épico 3: Produtores/Empresas e Propriedades

As rotas privadas de empresas/produtores (`/empresas`, `/companies`, `/produtores`, `/producers`) e propriedades (`/propriedades`, `/properties`) usam `PrincipalGuard`. O guard exige `request.user.id` de um middleware de autenticação confiável e valida se o usuário existe e está ativo. A autorização dos serviços usa as permissões e vínculos existentes no banco; os identificadores enviados na URL não concedem acesso por si só.

> **Bloqueio de produção:** este repositório ainda não implementa login, validação de token nem middleware que atribua a identidade confiável a `request.user`. Portanto, na aplicação atual, as rotas protegidas respondem `401` quando não recebem essa identidade. Não exponha as rotas a usuários reais ou à internet até integrar e validar um provedor de autenticação confiável; não é suficiente enviar um `userId` no payload ou cabeçalho.

Permissões reconhecidas em `Permissao.chave`:

| Chave | Alcance |
| --- | --- |
| `epic3:admin` | Administração ampla de empresas, propriedades, associações e leitura de documentos |
| `empresas:ler` | Leitura global de empresas/produtores |
| `empresas:gerenciar` | Criação, edição e inativação de empresas/produtores |
| `empresas:associar` | Gerenciamento de vínculos de usuários a empresas dentro do escopo autorizado |
| `empresas:documento:ler` | Leitura completa de CPF/CNPJ |
| `propriedades:ler` | Leitura global de propriedades e consulta de propriedades de outros usuários |
| `propriedades:gerenciar` | Criação, edição e inativação de propriedades |
| `propriedades:associar` | Gerenciamento de vínculos de usuários a propriedades dentro do escopo autorizado |

Sem permissão global de leitura/gerenciamento, o escopo é limitado aos vínculos ativos do usuário com empresas e propriedades. Operações de associação exigem a permissão específica e acesso ao registro relacionado. CPF/CNPJ é mascarado nas listagens, detalhes e respostas de associação; a permissão `empresas:documento:ler` é necessária para revelar o valor completo. Projeções de usuários vinculados omitem CPF, senha/hash e demais credenciais.

Rotas de associação:

| Método e rota | Ação |
| --- | --- |
| `GET /empresas/:id/usuarios` | Lista vínculos ativos e dados públicos dos usuários |
| `GET /empresas/:id/usuarios/disponiveis` | Lista usuários ativos ainda não vinculados |
| `POST /empresas/:id/usuarios` | Cria ou reativa um vínculo, com chave única por usuário/empresa |
| `DELETE /empresas/:id/usuarios/:userId` | Inativa o vínculo sem apagar o histórico |
| `GET /propriedades/:id/usuarios` | Lista vínculos ativos e dados públicos dos usuários |
| `GET /propriedades/:id/usuarios/disponiveis` | Lista usuários ativos ainda não vinculados |
| `POST /propriedades/:id/usuarios` | Cria ou reativa um vínculo, com chave única por usuário/propriedade |
| `DELETE /propriedades/:id/usuarios/:userId` | Inativa o vínculo sem apagar o histórico |
| `GET /propriedades/por-usuario/:userId` | Lista propriedades vinculadas ao próprio usuário; consultar outro usuário exige `propriedades:ler` ou `epic3:admin` |

As rotas existentes `GET /:id/associacoes` e `POST /:id/associacoes` continuam como aliases para consulta/criação de vínculo. Os mesmos endpoints estão disponíveis sob os aliases de idioma inglês já adotados pelos controllers.

Listagens de empresas/produtores e propriedades aceitam `page` e `limit`: página padrão `1`, tamanho padrão `20` e limite máximo `100`. Valores não inteiros, zero, negativos ou acima do máximo retornam `400`. A resposta tem o formato `{ "data": [], "meta": { "page": 1, "limit": 20, "total": 0, "totalPages": 0 } }`; filtros existentes são mantidos e aplicados no banco junto ao escopo de autorização.

---

## 🧹 3. Boas Práticas e Clean Code Aplicadas

| Princípio | Como foi aplicado no projeto |
| :--- | :--- |
| **Single Responsibility (SRP)** | Os controllers cuidam apenas de requisição e resposta HTTP; a lógica de negócio reside exclusivamente nos serviços; DTOs definem contratos. |
| **Dependency Inversion (DIP)** | `ReadingsService` não instancia `AlertsService` diretamente; a comunicação ocorre via injeção de dependência do NestJS. |
| **Fail Fast & Validação Antecipada** | Payloads são validados antes de qualquer consulta pesada ao banco de dados, retornando erros HTTP padronizados (`400 Bad Request`, `401 Unauthorized`, `404 Not Found`). |
| **Idempotência & Segurança** | Alertas idênticos repetidos são prevenidos; chaves de hardware são protegidas por índices `UNIQUE` no schema. |
| **Zero Erros de Tipagem & Linting** | Cobertura estrita de tipos TypeScript sem `any` abusivo, 0 erros no Oxlint e 100% de testes unitários passando no Vitest. |

---

## 🚀 4. Guia de Execução Rápida para a Equipe

### Pré-requisitos
- Node.js instalado (v20+)
- PostgreSQL rodando localmente (porta 5432)

### 1. Configurar o arquivo `.env`
Crie ou confirme o arquivo `backend/.env` com as configurações:
```env
DATABASE_URL="postgresql://postgres:1234@localhost:5432/postgres?schema=public"
DEVICE_API_KEY="iot-simulator-secret-2026"
PORT=3000
```

### 2. Sincronizar o Banco e Popular Dados de Teste
```bash
cd backend
npx prisma db push
npx prisma db seed
```

### 3. Subir a API (Terminal 1)
```bash
npm run start:dev
```
A API ficará acessível em `http://localhost:3000`.

### 4. Subir o Simulador IoT (Terminal 2)
```bash
npm run simulator
```

---

## 🧭 5. Guia para Implementação dos Próximos Épicos

Quando for desenvolver os próximos épicos previstos na modelagem (como **Colheita**, **Operações Logísticas**, **Recomendações de Exportação** ou **Valores de Mercado**), siga este padrão:

### 1. O schema já possui as tabelas prontas
No [`schema.prisma`](file:///c:/Users/aluno/backend-nest.js/backend/prisma/schema.prisma) você já encontrará entidades modeladas e relacionadas:
- `Talhao_Cultura` e `Colheita` (para gestão de safras e previsões)
- `Operacao_Logistica` (para transporte, custos e modais)
- `Valor_Mercado` (para cotações de frutas por país/mercado de destino)
- `Recomendacao_Colheita` e `Recomendacao_Exportacao` (para regras de inteligência de exportação)

### 2. Padrão para criar um novo módulo no NestJS
1. Crie a pasta em `backend/src/<nome_modulo>/`.
2. Crie os DTOs em `backend/src/<nome_modulo>/dto/`.
3. Crie `<nome_modulo>.service.ts` injetando `PrismaService`.
4. Crie `<nome_modulo>.controller.ts` mapeando os endpoints REST.
5. Crie `<nome_modulo>.module.ts` e adicione o módulo no array `imports` de [`src/app.module.ts`](file:///c:/Users/aluno/backend-nest.js/backend/src/app.module.ts).
6. Escreva os testes unitários em `<nome_modulo>.service.spec.ts`.

### 3. Scripts de Verificação de Qualidade
Antes de abrir commits ou pull requests, execute a suíte de qualidade:
```bash
npm run lint      # Verifica boas práticas e problemas estáticos
npm run format    # Aplica a formatação do Prettier
npm test          # Executa todos os testes unitários
npm run build     # Confirma se o build TypeScript está íntegro
```
