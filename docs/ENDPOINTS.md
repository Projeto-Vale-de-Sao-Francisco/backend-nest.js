# SIVALE — Endpoints da API

Documentação interativa (Swagger UI): `http://localhost:3333/docs`. Esta lista resume as rotas por módulo.

- **Autenticação:** `Authorization: Bearer <token>` em todas as rotas, exceto as marcadas como públicas.
- **Perfis:** `ADM` administrador · `GES` gestor · `TEC` técnico · `AGR` agricultor. "todos" = qualquer usuário logado. Só o `ADM` cadastra, edita e inativa; veja [PERFIS_E_TELAS](PERFIS_E_TELAS.md).
- **Escopo:** o `ADM` vê tudo; o `GES` vê as propriedades das empresas vinculadas; `TEC` e `AGR` veem só as propriedades vinculadas.
- **Erros:** JSON `{ statusCode, message, error }`. `400` validação · `401` token ausente/inválido · `403` sem permissão · `404` não encontrado (ou fora do escopo) · `409` duplicado · `422` regra de negócio.

## Autenticação

| Método e rota | Perfis | Descrição |
|---|---|---|
| `POST /auth/login` | público | E-mail e senha; devolve `{ token, usuario }` |
| `GET /auth/me` | todos | Usuário autenticado com perfil, empresas e propriedades vinculadas |
| `POST /auth/logout` | todos | Revoga os tokens já emitidos para o usuário e devolve `204` |

Não há autocadastro: os usuários são criados pelo administrador.

## Usuários e vínculos (somente ADM)

| Método e rota | Descrição |
|---|---|
| `GET /usuarios` | Lista com perfil, status, empresas e propriedades vinculadas |
| `POST /usuarios` | Cadastra (CPF e e-mail únicos, senha com hash) |
| `PATCH /usuarios/:id` | Edita, troca o perfil, ativa/inativa (não vale para a própria conta) |
| `POST /usuarios/:id/empresas` · `DELETE /usuarios/:id/empresas/:empresaId` | Vincula/remove a empresa (o Gestor passa a ver todas as propriedades dela) |
| `POST /usuarios/:id/propriedades` · `DELETE /usuarios/:id/propriedades/:propriedadeId` | Vincula/remove a propriedade |

## Cadastros

| Método e rota | Perfis | Descrição |
|---|---|---|
| `GET/POST /empresas`, `GET/PATCH /empresas/:id` | ADM | Produtores/empresas; CPF/CNPJ único |
| `GET /propriedades`, `GET /propriedades/:id` | todos | Propriedades (com empresa, talhões e usuários vinculados) |
| `POST /propriedades`, `PATCH /propriedades/:id` | ADM | Cadastro e edição (latitude, longitude, área total) |
| `POST /propriedades/:id/usuarios`, `DELETE /propriedades/:id/usuarios/:usuarioId` | ADM | Vínculo de usuário pela propriedade |
| `GET /culturas`, `GET /culturas/:id` | todos | Culturas com faixa de temperatura e umidade |
| `POST /culturas`, `PATCH /culturas/:id` | ADM | Cadastro e edição |
| `GET /talhoes?propriedadeId&culturaId`, `GET /talhoes/:id` | todos | Talhões |
| `POST /talhoes`, `PATCH /talhoes/:id` | ADM | Cadastro e edição; soma das áreas ≤ área da propriedade |

## IoT e leituras

| Método e rota | Perfis | Descrição |
|---|---|---|
| `GET /dispositivos?talhaoId&propriedadeId` | todos | Dispositivos com última medição, minutos desde ela e `semComunicacao` |
| `GET /dispositivos/:id` | todos | Detalhe com sensores |
| `POST /dispositivos`, `PATCH /dispositivos/:id` | ADM | Cadastro (devolve a chave **uma vez**) e edição/ativação |
| `POST /dispositivos/:id/chave` | ADM | Gera nova chave; a anterior deixa de valer |
| `GET /sensores?dispositivoId` | todos | Sensores de cada dispositivo |
| `POST /sensores`, `PATCH /sensores/:id` | ADM | Cadastro e edição |
| `POST /ingest/medicoes` | público + `x-device-key` | **Única porta de entrada de leituras** (ESP32 ou simulador). Corpo: `{ temperatura, umidade, umidadeSolo?, luminosidade?, precipitacao?, dataHora? }` |
| `GET /medicoes?dispositivoId&talhaoId&propriedadeId&culturaId&inicio&fim&limite&pagina` | todos | Paginado: `{ dados, total, pagina, limite, paginas }` |

Nenhum perfil registra leitura manualmente (não existe `POST /medicoes`). Validação: temperatura de −30 a 70 °C, umidade de 0 a 100 %; dispositivo inativo recusa (422).

Exemplo (o que o ESP32 envia):

```bash
curl -X POST http://localhost:3333/ingest/medicoes \
  -H "x-device-key: sv_..." -H "Content-Type: application/json" \
  -d '{"temperatura": 28.4, "umidade": 55}'
```

## Alertas

| Método e rota | Perfis | Descrição |
|---|---|---|
| `GET /alertas?talhaoId&propriedadeId&visualizado&resolvido&nivel` | todos | Lista com talhão e cultura (mais recentes primeiro) |
| `PATCH /alertas/:id/visualizar` | todos | Marca como visto |
| `PATCH /alertas/:id/resolver` | todos | Marca como resolvido |
| `POST /alertas/verificar-comunicacao` | ADM | Roda a verificação de falha de sensor na hora (também roda a cada 5 min) |

## Dashboards

| Método e rota | Descrição |
|---|---|
| `GET /dashboard/resumo` | Cards: temperatura/umidade atual e média, dispositivos ativos, total de medições, alertas ativos (aceita os filtros de `/medicoes`) |
| `GET /dashboard/historico` | Série temporal para os gráficos (últimos 500 pontos). Filtros: `propriedadeId`, `talhaoId`, `culturaId`, `dispositivoId`, `inicio`, `fim` |
| `GET /dashboard/talhao/:id/saude?horas=24` | **T1** — valor atual, semáforo pela faixa da cultura, última leitura, dispositivos online, série |
| `GET /dashboard/talhao/:id/alertas?dias=7` | **T2** — alertas por tipo/status e por dispositivo (condição real × falha de sensor) |
| `GET /dashboard/propriedade/:id/ranking-alertas` | **P2** — talhões ordenados por score de alertas pendentes |

## Mercado e logística

| Método e rota | Perfis | Descrição |
|---|---|---|
| `GET /mercado?culturaId&mercadoDestino` | todos | Valores de mercado/exportação |
| `POST /mercado`, `PATCH /mercado/:id`, `DELETE /mercado/:id` | ADM | Cadastro manual |
| `POST /mercado/atualizar` | ADM | **Botão "Atualizar valores"**: busca a fonte (`MERCADO_FONTE_URL`); cria ou corrige o valor do mesmo dia, cultura e destino |
| `GET /logistica?propriedadeId` | todos | Operações logísticas |
| `POST /logistica`, `PATCH /logistica/:id` | ADM | Cadastro e edição |

## Integração opcional (somente ADM)

| Método e rota | Descrição |
|---|---|
| `GET /thingspeak/dados` | Último feed do canal ThingSpeak |
| `GET /thingspeak/enviar?temperatura&umidade` | Publica no canal |
| `GET /thingspeak/salvar?dispositivo=<codigo>` | Grava a última leitura do canal como medição do dispositivo |
