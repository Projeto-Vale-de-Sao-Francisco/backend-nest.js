# SIVALE — ValeVivo Backend (NestJS)

API de backend do projeto **ValeVivo**, responsável pela telemetria IoT, gestão de sensores agrícolas, detecção de anomalias climáticas e suporte às operações do agronegócio no Vale do São Francisco.

Para a documentação completa de arquitetura, regras de negócio e guia dos próximos épicos, consulte:
👉 **[DOCUMENTACAO_TECNICA.md](../DOCUMENTACAO_TECNICA.md)**

---

## 🚀 Como Iniciar Rapidamente

1. **Configurar variáveis de ambiente (`.env`):**
   ```env
   DATABASE_URL="postgresql://usuario:senha@localhost:5432/valevivo"
   DEVICE_API_KEY=""
   DEVICE_API_KEY_LEGACY_ENABLED=false
   DEVICE_API_KEY_LEGACY_DEVICE_ID=""
   DEVICE_TOKEN_ESP32_TALHAO_01=""
   DEVICE_TOKEN_SEN_TH_02=""
   JWT_SECRET="defina-uma-chave-aleatoria-de-pelo-menos-32-caracteres"
   JWT_EXPIRES_IN="1h"
   JWT_ISSUER="sivale-api"
   JWT_AUDIENCE="sivale-frontend"
   CORS_ORIGINS="https://seu-dominio.example"
   TRUST_PROXY_HOPS="0"
   LOGIN_RATE_MAX_ATTEMPTS="5"
   LOGIN_RATE_WINDOW_MS="900000"
   LOGIN_RATE_BLOCK_MS="900000"
   SEED_ADMIN_NOME="Nome do administrador inicial"
   SEED_ADMIN_EMAIL="email-administrativo"
   SEED_ADMIN_SENHA="defina-uma-senha-forte"
   SEED_ADMIN_CPF="CPF fornecido pelo administrador do ambiente"
   PORT=3000
   ```

2. **Aplicar migrations e popular dados iniciais:**
   ```bash
   npx prisma migrate deploy
   npx prisma db seed
   ```

3. **Executar a API em modo de desenvolvimento:**
   ```bash
   npm run start:dev
   ```

4. **Executar o simulador de sensores IoT (em outro terminal):**
   ```bash
   npm run simulator
   ```

---

## 🧪 Qualidade de Código e Testes

```bash
npm run lint      # Checagem de linter com Oxlint
npm run format    # Formatação com Prettier
npm test          # Suíte de testes unitários com Vitest
npm run build     # Compilação TypeScript de produção
```

## Pipeline de ingestão e qualidade de dados

O backend inclui um módulo de pipeline de qualidade (`src/pipeline`) para padronizar registros de sensores, climáticos, mercado e câmbio antes de consumo analítico. O serviço centraliza:

- normalização de datas e fusos em UTC;
- identificação de valores ausentes e descarte automático;
- remoção de duplicados por chave determinística;
- marcação de outliers como suspeitos sem apagar o dado original;
- conversão e padronização de moedas e unidades;
- persistência de execuções e problemas em tabelas `Pipeline_Execucao` e `Pipeline_Problema`;
- endpoints REST em `/pipeline/executar`, `/pipeline/execucoes`, `/pipeline/execucoes/:id` e `/pipeline/execucoes/:id/relatorio`.

A execução automática também é disparada após gravações válidas de leituras em `ReadingsService`.

## Usuários e autenticação

Copie `.env.example` para `.env` e defina valores seguros. Para o administrador
inicial, `SEED_ADMIN_NOME`, `SEED_ADMIN_EMAIL`, `SEED_ADMIN_SENHA` e
`SEED_ADMIN_CPF` são obrigatórios. `SEED_ADMIN_TELEFONE` e
`SEED_ADMIN_VINCULO` são opcionais; sem eles, o seed usa respectivamente
`0000000000` e `Administração`.

Após aplicar as migrations, execute:

```bash
npx prisma db seed
```

## Segurança e auditoria

- Senhas novas e redefinidas são armazenadas com bcrypt fator 12, comparadas por
  `bcrypt.compare` e limitadas a 72 bytes UTF-8 para evitar truncamento do bcrypt.
  Senha/hash nunca é selecionado nas respostas.
- JWT usa HS256 explicitamente, expiração configurável e validação de emissor e
  público (`JWT_ISSUER`/`JWT_AUDIENCE`). Use `JWT_SECRET` aleatório com no mínimo
  32 caracteres e nunca reutilize o exemplo.
- O login web envia o JWT somente como cookie `HttpOnly`, `SameSite=Strict`,
  `Secure` em produção e `Path=/`; o JSON contém apenas o perfil do usuário.
  O frontend usa `credentials: include` e `/api` same-origin. Mutations com
  cookie e o login exigem um `Origin` permitido. Bearer continua aceito para
  clientes não-browser; não grave tokens em armazenamento acessível por JS.
- `POST /auth/login` aplica limites configuráveis por IP e por hash do e-mail
  no PostgreSQL compartilhado. O contador usa upsert atômico, bloqueio temporário
  e limpeza limitada a 500 buckets inativos com mais de 24 horas por falha;
  buckets usados pela requisição e bloqueios ainda ativos são preservados. Se
  o banco não estiver disponível, o login falha com `503`; a proteção não é
  silenciosamente desativada. Todas as
  instâncias devem usar o mesmo `DATABASE_URL`.
- CORS em produção permite somente `CORS_ORIGINS`, uma lista de origens HTTPS
  separadas por vírgula. TLS e redirecionamento HTTP→HTTPS devem ser configurados
  no serviço de hospedagem/proxy. `TRUST_PROXY_HOPS` deve corresponder somente à
  cadeia fixa de proxies confiáveis; o padrão `0` não confia em cabeçalhos do cliente.
  No Render, configure o número de saltos apenas após confirmar a cadeia publicada.
- A API define CSP restritiva, `X-Content-Type-Options`, `Referrer-Policy`,
  `X-Frame-Options` e HSTS em produção.
- Em produção, `DATABASE_URL` deve usar uma role de runtime que não seja
  proprietária de `Audit_Log` e não tenha `UPDATE`, `DELETE`, `TRUNCATE` ou
  `TRIGGER` nessa tabela. O backend recusa iniciar se esses privilégios forem
  detectados. Configure uma role `NOLOGIN` separada como proprietária da tabela
  e conceda à role de runtime somente `SELECT` e `INSERT` (incluindo `USAGE`/
  `SELECT` na sequence). Use `MIGRATIONS_DATABASE_URL` apenas no deploy para
  aplicar migrations com uma role privilegiada; não a disponibilize ao processo
  da API. Mesmo assim, superusuários do PostgreSQL podem alterar o schema e não
  podem ser impedidos pela aplicação.
- `POST /readings` autentica cada dispositivo por `x-device-token`. O token é
  aleatório e armazenado apenas como SHA-256. Ele nunca é retornado pela API.
  `DELETE /devices/:id/credential` (ADMIN) revoga o token.
- Para provisionar ou rotacionar, execute no backend
  `npm run device:credential -- --device-id=<id> --admin-id=<id> --ip-origem=<ip>`
  após configurar a conexão com o banco. O comando valida um administrador
  ativo e um IP válido, substitui a credencial anterior e exibe o token uma
  única vez no terminal. Guarde-o no gerenciador de segredos do integrador; não
  o registre em logs ou no frontend.
- A migration `20261116180000_device_credentials_login_rate_limit` cria as
  tabelas de credenciais e rate limit sem alterar ou apagar dispositivos. Após
  aplicá-la, um ADMIN deve emitir um token para cada dispositivo existente e
  guardá-lo no segredo do integrador. O simulador usa
  `DEVICE_TOKEN_<CODIGO_NORMALIZADO>` (caracteres não alfanuméricos viram `_`).
  Credenciais não são criadas automaticamente pela migration.
- Para transição temporária, a antiga `DEVICE_API_KEY` só é aceita se
  `DEVICE_API_KEY_LEGACY_ENABLED=true` e `DEVICE_API_KEY_LEGACY_DEVICE_ID`
  apontar para um único dispositivo ativo. O corpo ainda precisa identificar
  esse mesmo dispositivo/sensor. Configure `SIMULATOR_LEGACY_DEVICE_CODE` para
  esse único código no simulador. Depois de migrar todos os integradores,
  desligue o modo legado e remova o segredo global do ambiente.
- Nos dois modos, o servidor deriva a identidade do dispositivo do header;
  `sensorId` e `codigoDispositivo` no corpo apenas selecionam/confirmam recursos
  do dispositivo autenticado e não podem mudar essa identidade. As rotas de
  consulta continuam exigindo JWT.
- A integração ThingSpeak exige `THINGSPEAK_CHANNEL_ID`,
  `THINGSPEAK_WRITE_API_KEY` e `THINGSPEAK_READ_API_KEY`. Não existem
  credenciais demonstrativas embutidas no código. Os endpoints administrativos
  de envio/consulta/importação exigem papel `ADMIN`.
- Usuários `COMUM` consultam dispositivos, leituras, alertas e dashboard somente
  das propriedades com vínculo `Usuario_Propriedade` ativo. Filtros recebidos
  do cliente não ampliam esse escopo; ausência de vínculo resulta em listas
  vazias/recursos não encontrados. Usuários `ADMIN` mantêm acesso global.
  Vínculos não são criados automaticamente.
- Na publicação, Render termina TLS; mantenha HTTPS habilitado e configure
  `CORS_ORIGINS` com o domínio HTTPS do frontend. O frontend Vercel envia HSTS e
  CSP; a API envia seus próprios headers e HSTS apenas em produção. Em localhost,
  HSTS não é emitido.
- `GET /audit-logs` exige papel `ADMIN`, aceita `usuarioId`, `acao`, `recurso`,
  `recursoId`, `dataInicio`, `dataFim`, `page` e `limit` (máximo 100). A migração
  `20261111210000_audit_indexes` adiciona índices sem remover dados.
- Usuários e alterações de status de usuários/dispositivos são registrados na
  mesma transação da operação, assim como alterações em culturas/talhões,
  alertas, logística, mercado, pipeline e importações de leituras. Operações de
  envio ao ThingSpeak também registram a tentativa antes da chamada externa.
  Os logs não guardam dados de perfil, CPF, senha ou token.
- Aplicar a migração: `npx prisma migrate deploy`. Validar backend: `npm test`,
  `npm run lint` e `npm run build`.
- Revisão de dependências (11/11/2026): as versões transitivas vulneráveis de
  `body-parser`, `deepmerge-ts`, `fast-uri`, `follow-redirects`, `multer`, `mysql2`,
  `qs`, `source-map-js`, `tmp` e `undici` foram corrigidas pela atualização
  compatível do lockfile e remoção de `@nestjs/mau`, que não era usado. Vitest e
  `@vitest/coverage-v8` foram atualizados para 5.1.0. A auditoria final do backend
  reportou zero vulnerabilidades.
- A varredura do histórico encontrou valores demonstrativos antigos para a senha
  do administrador inicial e para a chave do simulador. O histórico não foi
  reescrito: se algum ambiente reutilizou esses exemplos, rotacione a senha do
  administrador, `DEVICE_API_KEY` e `JWT_SECRET` e invalide as sessões existentes.
  Os arquivos `.env` locais do frontend continham somente `VITE_API_URL` (valor
  público); eles foram removidos do índice e permanecem no disco local, ignorados
  pelo Git. Nenhum token privado ou chave de provedor foi confirmado pela varredura.
- O frontend remove chaves antigas de autenticação do `localStorage`; guarda
  somente ID, nome e perfil em `sessionStorage` para controle visual de rotas.
  A autenticação/autorização real permanece no cookie e no backend.

## E7 — Mercado, Etapa A

Endpoints e roteiro de teste: [ENDPOINTS-E7.md](../ENDPOINTS-E7.md). Apenas backend; CSV, logística e resumo ficam para as próximas etapas. Não é necessário executar migrations, `db push`, reset ou seed para esta entrega. O banco é compartilhado: não execute esses comandos do guia rápido acima para testar E7.

### Configuração

O arquivo `.env.example` contém exemplos sem segredos. Ajuste manualmente seu ambiente; esta implementação não modifica `.env`.

| Variável | Padrão | Uso |
|---|---|---|
| `MERCADO_FONTES_ATIVAS` | `comexstat` | IDs separados por vírgula; `""` desliga todas as fontes |
| `MERCADO_CACHE_TTL_MIN` | `60` | TTL do cache de fontes e da PTAX, em minutos |
| `MERCADO_HTTP_TIMEOUT_MS` | `10000` | Timeout por tentativa, incluindo a leitura do corpo |
| `COMEXSTAT_ESTADOS` | `26,32` | Pernambuco e Bahia no catálogo do Comex Stat; `""` consulta Brasil inteiro |
| `COMEXSTAT_MESES` | `12` | Últimos meses completos, excluindo o mês corrente; entre 1 e 24 |

A [API oficial do Comex Stat](https://api-comexstat.mdic.gov.br/docs) e seu endpoint `/general/filters/state` foram consultados em 11/10/2026: PE é **26** e BA é **32** neste catálogo. **29 é código IBGE, não o ID de Bahia retornado por essa API**. Foi conferida uma consulta real de exportações de uva em agosto/2026. A resposta usa `success: true`, `data.list` e os campos `year`, `monthNumber`, `country`, `metricFOB`, `metricKG` (métricas numéricas em strings). A consulta sempre restringe NCM e período; meses sem publicação não são fabricados.

O dado é **valor médio de exportação**: FOB em USD dividido pelo peso líquido em kg, por país e mês. `demanda_estimada` é o peso exportado naquele mês em kg, usado como **proxy**, não previsão de demanda. Peso zero é ignorado. `data_referencia` é o primeiro dia do mês em UTC. Se houver linhas repetidas de país/mês, somam-se FOB e peso antes da divisão.

A PTAX é consultada via `CotacaoDolarPeriodo` (datas `MM-DD-YYYY`), janela de sete dias incluindo hoje em São Paulo, escolhendo o fechamento mais recente. Esse recurso já retorna fechamentos, sem `tipoBoletim`. A consulta real no domingo 11/10/2026 retornou o fechamento de sexta 09/10/2026. Usa-se a taxa de venda USD/BRL; o câmbio não é gravado. Sem PTAX, `cambio` e preço BRL são `null`. Somente valores armazenados em USD são convertidos; EUR/BRL e outras moedas não são rotuladas como USD nem misturadas em médias.

### Adicionar cultura ou fonte

Edite `src/mercado/fontes/culturas-ncm.config.ts`: chaves são nomes sem acentos, em minúsculas e sem espaços nas extremidades; valores são listas de NCMs de oito dígitos. Inicialmente: `manga -> 08045020`, `uva fresca -> 08061000`. Cadastre a Cultura com esse nome ou acrescente um alias ao mapa. Uva fresca foi confirmada no [Comex Stat](https://comexstat.mdic.gov.br/pt/geral/134583). Sem mapeamento, a atualização responde 400 com `Cultura sem fonte de cotação configurada`.

Para adicionar uma fonte, crie um arquivo `src/mercado/fontes/<nome>.fonte.ts` com classe `@Injectable()` que implemente `FonteMercado` e a exporte como **default**. O módulo descobre automaticamente classes locais `*.fonte.ts` em desenvolvimento e `*.fonte.js` no build. Inclua o ID em `MERCADO_FONTES_ATIVAS` e reinicie a aplicação. Não é preciso alterar controller, service ou módulo. URLs são constantes de cada classe, com allowlist de hosts; IDs de usuários ou do ambiente jamais são usados como caminho de importação. Uma fonte nova deve validar seu contrato externo e retornar o contrato normalizado (Decimal como string, USD/kg). Nesta etapa a gravação aceita USD/kg; uma futura fonte em outra moeda exige ampliar explicitamente esse contrato. A arquitetura permite uma fonte Conab futura, mas nenhuma foi usada ou implementada.

### Cache, falhas e limitações

Cache em `Map`, por fonte/cultura, com Promise compartilhada que inclui a consulta **e a transação**. Forçar ignora TTL, mas compartilha uma atualização em andamento e respeita `Retry-After`. Só após a transação ter sucesso o cache é publicado. No máximo uma repetição em erro de rede, timeout ou 5xx, com espera de 250 ms. 429 não é repetido: o host fica bloqueado pelo `Retry-After` (segundos ou data HTTP); sem header válido usa-se 60 segundos. Redirecionamentos são recusados. HTTPS e hosts permitidos são verificados antes do fetch; o corpo é limitado a 5 MB durante a leitura, mesmo sem `Content-Length`.

Falha da fonte com dados armazenados devolve 200, dados antigos, `desatualizado: true` e `fonte_erro` curto em português. Sem dados armazenados devolve 502. O lote externo inteiro é validado antes de gravar. Logs nunca incluem payload externo, arquivo, credenciais ou mensagens internas do Prisma.

O cache e diagnósticos reiniciam com a aplicação e **não são compartilhados entre instâncias**. Não existe coluna de fonte ou timestamp de atualização no schema: `atualizado_em` indica a última atualização bem-sucedida conhecida em memória para a cultura, não o mês do dado; após restart é `null` e `desatualizado` é `true`. Desatualização também ocorre por erro ou TTL vencido. `/mercado/cotacao` lê os dados gravados e consulta somente a PTAX; para atualizar mercado use explicitamente POST `/mercado/atualizar`. A marcação é por cultura, não comprova a origem de cada registro manual nem garante que todo país teve movimento no último mês.

Preços `preco`, `preco_usd` e `preco_brl` são sempre **strings decimais** (ou `null` quando não há conversão). Entrada manual aceita string decimal com ponto ou número JSON positivo; prefira strings para preservar precisão. Cálculos usam `Prisma.Decimal` (precisão padrão da biblioteca: 20 dígitos significativos); a taxa `usd_brl` e a demanda são números. Datas ISO sem horário no filtro final incluem o dia inteiro em UTC; timestamps completos preservam o horário informado.

Duplicidade lógica: `(cultura_id, mercado_destino, data_referencia)`, comparação exata de destino e instante. Cadastro manual rejeita com 409; atualização da fonte altera o existente ou insere, dentro de transação. `POST /mercado/atualizar` pode sobrescrever um registro manual com essa mesma chave, alterando `pais_destino`, `preco`, `moeda`, `unidade_medida` e `demanda_estimada`. Os nomes de país vêm do catálogo do Comex Stat (por exemplo, `Países Baixos (Holanda)`); grafias diferentes, como `Países Baixos` ou `Holanda`, geram registros separados. **Sem constraint única**, transações concorrentes de instâncias distintas, fontes diferentes ou cadastro manual simultâneo ainda podem inserir duplicatas. A Promise compartilhada reduz esse risco para a mesma fonte/cultura nesta instância, mas não substitui constraint no banco. Não há migration ou limpeza de duplicatas nesta entrega.

Testes usam Prisma e fetch mockados, incluindo contrato real, validação de lote, cache, concorrência, 429, timeout, falhas e permissões; nenhum teste acessa banco ou internet. Não foi validada a execução HTTP completa contra o PostgreSQL compartilhado nem feitas gravações nele.

### Dados de demonstração para testes manuais do E7

`prisma/seed-demo.ts` é separado do seed existente e cria somente dados de teste, **não de produção**. Não cria usuários ADMIN/COMUM nem altera registros existentes. Execute manualmente dentro de `backend/`, com as migrations já aplicadas e `DATABASE_URL` configurada no ambiente ou no `.env`:

```powershell
$env:SEED_DEMO_CONFIRMAR="sim"
try { npm run seed:demo } finally { Remove-Item Env:SEED_DEMO_CONFIRMAR }
```

A confirmação precisa estar no ambiente do comando: colocá-la apenas no `.env` não autoriza a execução. Sem `SEED_DEMO_CONFIRMAR=sim`, o script informa como confirmar e termina antes de carregar `.env`, instanciar o client ou acessar o banco. Não execute reset, db push ou o seed existente para preparar estes testes.

O script usa o mesmo `PrismaClient` gerado e `PrismaPg` do seed existente. Em uma transação, cria ou reutiliza, nesta ordem: Cultura `Manga`, Cultura `Uva fresca`, Empresa `[DEMO] Agro E7`, Propriedade `[DEMO] Fazenda Teste` (Petrolina/PE), Talhão `[DEMO] Talhão 1`, `Talhao_Cultura` ligado à Manga e Colheita prevista para `2026-11-01`. No fim imprime uma tabela com `registro`, `id` e `situacao` (`criado agora` ou `já existia`). Os ids reais dependem do banco.

Identificação natural: culturas pelo nome exato; empresa pela razão social; propriedade/talhão pelo nome e FK do pai; `Talhao_Cultura` pelo par talhão/cultura; Colheita pelo vínculo e data prevista fixa. Uma segunda execução sequencial reutiliza os registros sem atualizar ou apagar nada. Execute uma instância por vez, pois o schema não possui constraints únicas para todas essas chaves. Se houver registros repetidos preexistentes, usa o menor id e não os remove.

O CNPJ fictício `99.999.999/0001-91` tem formato e dígitos verificadores válidos; isso não comprova disponibilidade em cadastro oficial. O script verifica colisão no banco nos formatos com e sem pontuação e aborta a transação se esse documento pertencer a outra empresa. Nenhuma empresa real é atualizada ou vinculada por esse documento. Datas e valores de demonstração são fixos para permitir repetição.

Use o id de Cultura Manga (ou Uva fresca) em `culturaId` na coleção [docs/E7.postman_collection.json](../docs/E7.postman_collection.json). Guarde também `empresa_id` e `colheita_id` para a futura Etapa C; este script não cria operações logísticas nem vínculos de usuários com empresas.
