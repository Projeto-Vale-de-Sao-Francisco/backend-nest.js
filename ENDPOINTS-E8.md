# E8 — Dashboard e histórico climático

Rotas protegidas por `Authorization: Bearer <token>`:

- `GET /dashboard/resumo`
- `GET /dashboard/historico`

Filtros opcionais: `propriedade_id`, `talhao_id`, `cultura_id`, `sensor_id`, `data_inicio` e `data_fim`. O histórico também aceita `page` (padrão 1) e `limit` (padrão 100, máximo 500).

Médias usam todas as medições filtradas no período; valores nulos não participam da média. Temperatura e umidade atuais e última comunicação usam a medição mais recente. Sensor ativo exige simultaneamente `Sensor.status = ativo` e `Dispositivo.status = ativo`.

Datas sem horário são interpretadas em UTC; `data_fim` sem horário inclui o dia inteiro. A série histórica é ordenada por `data_hora` e `id`, ambos crescentes.

A comparação usa a cultura ativa mais recente do talhão. Quando `cultura_id` é informado, usa esse vínculo ativo. Sem medições, os campos atuais ficam nulos e a resposta traz uma mensagem. Sem cultura ativa ou parâmetros, a comparação retorna `disponivel: false` e o motivo.
