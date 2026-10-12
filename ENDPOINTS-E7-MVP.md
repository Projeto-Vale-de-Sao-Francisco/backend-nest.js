# E7 — complemento MVP: edição, resumo e logística

Base local `http://localhost:3001`. Todas as rotas exigem Bearer JWT. ADMIN cria/edita; ADMIN e COMUM consultam. Não há DELETE ou CSV.

## Mercado

- `PATCH /mercado/:id`: campos parciais do cadastro (`cultura_id`, `mercado_destino`, `pais_destino`, `preco`, `moeda`, `unidade_medida`, `data_referencia`, `demanda_estimada`). Body vazio: 400; campo extra/inválido: 400; recurso/cultura ausente: 404; chave lógica duplicada: 409. Comparação exata de `(cultura_id, mercado_destino, data_referencia)`, excluindo o próprio id. Preços decimais devem ser enviados como strings.
- `GET /mercado/resumo`: filtros `cultura_id`, `mercado_destino`, `data_inicio`, `data_fim`. Retorna `quantidade_registros`, `quantidade_destinos`, `periodo_disponivel` e `grupos`. Cada grupo contém cultura, moeda, unidade, contagens e preços mínimo/médio/máximo em strings. Média aritmética por registro, sem ponderação por demanda. Inclui todos os registros filtrados, independentemente de paginação. Sem dados: contagens zero, datas null, grupos vazios.

Limite do schema: não há coluna de origem. PATCH é destinado à manutenção manual, mas a API não consegue impedir edição de registros importados. Comex Stat pode sobrescrever posteriormente um registro com a mesma chave. Sem constraint única, a verificação de duplicidade não garante exclusão entre escritores concorrentes. O resumo não consulta fontes externas nem converte moedas; a implementação agrega em memória os registros filtrados, adequada ao volume de MVP.

## Logística

- `POST /logistica`: ADMIN; 201.
- `GET /logistica`: JWT; lista paginada.
- `GET /logistica/resumo`: JWT; indicadores sem paginação.
- `GET /logistica/:id`: JWT; detalhe.
- `PATCH /logistica/:id`: ADMIN; edição parcial, body vazio rejeitado.

Campos obrigatórios do POST: `empresa_id`, `colheita_id`, `origem`, `destino`, `modal`, `status`. Opcionais: `transportadora`, `data_prevista`, `tempo_estimado_horas`, `custo_estimado`. IDs positivos; textos obrigatórios não vazios; números finitos >= 0; data ISO válida e não anterior ao plantio. Campos opcionais aceitam null para limpeza no PATCH. Campos extras são rejeitados.

Status do MVP (normalizados para minúsculas): `planejada`, `em_transporte`, `concluida`, `cancelada`. Modal é texto livre. Esses contratos são validados na API, pois o banco armazena texto sem enum. Não há máquina de transições entre status.

A empresa é conferida pela relação Colheita → Talhao_Cultura → Talhao → Propriedade → empresa_id. POST e PATCH validam a relação dentro de transação. Erros: 400 para relação inválida, dados inválidos ou período invertido; 404 para recurso/referência ausente; 401 sem JWT; 403 na escrita com COMUM; 503 em falha de armazenamento sem mensagem interna.

Filtros de lista e resumo: `empresa_id`, `colheita_id`, `status`, `destino` (busca parcial), `modal` (igualdade sem diferenciar maiúsculas), `data_inicio`, `data_fim` (sobre data prevista). Lista: `page=1`, `limit=20`, máximo 100. Data final sem horário inclui o dia completo em UTC. Consultas retornam empresa (id, razão social, nome fantasia) e colheita com plantio, cultura, talhão e propriedade.

Resumo: `quantidade_operacoes`, `por_status`, `custo_estimado_total`, `tempo_medio_horas`. Custos nulos não somam; tempos nulos não participam da média; sem dados: custo 0, tempo null. Inclui todos os status, salvo filtro explícito. O schema não possui moeda para custos: para o MVP, cadastrem todos os custos na mesma moeda (BRL); o total não faz conversão.

### Requests mínimas

```http
PATCH /mercado/1
Authorization: Bearer <ADMIN>
Content-Type: application/json

{"preco":"2.75"}
```

```http
POST /logistica
Authorization: Bearer <ADMIN>
Content-Type: application/json

{"empresa_id":2,"colheita_id":1,"origem":"Petrolina","destino":"Recife","modal":"rodoviario","status":"planejada","custo_estimado":1200,"tempo_estimado_horas":8,"data_prevista":"2026-11-02"}
```

IDs são ilustrativos: usar Empresa e Colheita existentes e relacionados. Esta implementação não executou gravações nem consultou o PostgreSQL compartilhado.
