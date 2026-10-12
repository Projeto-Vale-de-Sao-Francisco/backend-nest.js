# Guia rápido da API para o frontend

Base local: `http://localhost:3000` (ou a porta definida em `PORT`). As rotas não têm prefixo `/api`.

Envie corpos JSON com `Content-Type: application/json`. Corpos com campos desconhecidos ou tipos incorretos são rejeitados com HTTP 400. IDs e valores de medições devem ser números; datas devem usar ISO 8601, por exemplo `2026-10-12T12:00:00.000Z`.

## Rotas

| Método | Rota | Uso / retorno |
| --- | --- | --- |
| GET | `/devices` | Lista de dispositivos, com `talhao.propriedade` e `sensores`. |
| GET | `/devices/:id` | Um dispositivo com as mesmas relações. |
| POST | `/devices` | Cadastra dispositivo e sensor; retorna o dispositivo criado. |
| PATCH | `/devices/:id/status` | Atualiza dispositivo e sensores; retorna o dispositivo atualizado. |
| GET | `/readings/latest` | Lista de sensores com a última medição; ideal para o dashboard. |
| GET | `/readings` | Histórico de medições com `sensor.dispositivo.talhao` e `alertas`. |
| POST | `/readings` | Registra medição e gera alertas; exige chave de dispositivo. |
| GET | `/alerts` | Lista de alertas com `medicao.sensor.dispositivo.talhao`. |
| GET | `/alerts/active` | Lista apenas alertas com status `ativo`. |
| PATCH | `/alerts/:id/view` | Sem corpo; retorna o alerta com `visualizado: true`. |
| PATCH | `/alerts/:id/resolve` | Sem corpo; retorna o alerta com `status: "resolvido"` e `visualizado: true`. |

GET e PATCH retornam HTTP **200**; POST retorna **201**. Listagens retornam arrays diretamente, sem envelope de paginação.

### Filtros (query string)

- `/devices`: `propriedadeId`, `talhaoId`, `lote` (alias de talhaoId; talhaoId tem prioridade), `status` (`ativo` ou `inativo`). Ordenação por código.
- `/readings`: `sensorId`, `talhaoId`, `codigoDispositivo`, `dataInicio`, `dataFim`, `limit`. Datas inicial e final inclusivas; dataInicio não pode ser posterior a dataFim. Retorna da mais recente para a mais antiga, com limite padrão de 100 e máximo de 1000; use limites inteiros positivos.
- `/alerts`: `status` (`ativo` ou `resolvido`), `visualizado` (`true` ou `false`), `talhaoId`. Ordenação da mais recente para a mais antiga.

Exemplos: `/devices?talhaoId=1&status=ativo`, `/readings?sensorId=1&limit=50`, `/alerts?status=ativo&visualizado=false`.

## Corpos das requisições

### Cadastrar dispositivo — POST /devices

Obrigatórios: `codigo` (único), `modelo` e `talhaoId` (talhão já existente).

```json
{
  "codigo": "ESP32-01",
  "modelo": "ESP32-DHT22",
  "talhaoId": 1
}
```

Opcionais: `propriedadeId` (deve corresponder à propriedade do talhão), `status` (padrão `ativo`), `tipoSensor` (padrão `temperatura_umidade`), `unidadeMedida` (padrão `°C, %`) e `dataInstalacao` (padrão: agora).

### Alterar status — PATCH /devices/1/status

```json
{ "status": "inativo" }
```

### Enviar leitura — POST /readings

Envie o header `x-api-key: <DEVICE_API_KEY>` ou `x-device-token: <DEVICE_API_KEY>`. A chave é configurada no backend; mantenha-a no servidor/integrador IoT, fora do bundle público do frontend.

```json
{
  "sensorId": 1,
  "temperatura": 28.5,
  "umidade": 65,
  "umidadeSolo": 42,
  "luminosidade": 1200,
  "precipitacao": 0,
  "dataHora": "2026-10-12T12:00:00.000Z"
}
```

- Obrigatórios: `temperatura` (-50 a 65 °C), `umidade` (0 a 100%) e `sensorId` **ou** `codigoDispositivo`. Se ambos forem enviados, sensorId tem prioridade.
- Opcionais: `umidadeSolo` (0 a 100%), `luminosidade` (>= 0 lux), `precipitacao` (>= 0 mm) e `dataHora` (padrão: agora).
- `pressao` é opcional, em hPa (>= 0), e é armazenada e retornada como `pressao`.
- O sensor e seu dispositivo precisam estar ativos; a ingestão não cria sensores substitutos.
- Resposta: `{ sucesso: true, mensagem, medicao, alertasGerados: [] }`. Os alertas dependem das culturas ativas e seus limites.

## Como consumir as respostas

Os campos persistidos usam nomes como `talhao_id`, `sensor_id`, `data_hora`, `umidade_solo` e `unidade_medida`, mesmo quando a entrada usa camelCase.

Em `GET /readings/latest`, cada item possui este formato (exemplo resumido):

```json
{
  "sensorId": 1,
  "tipo": "temperatura_umidade",
  "unidadeMedida": "°C, %",
  "status": "ativo",
  "dispositivo": {
    "id": 1,
    "codigo": "ESP32-01",
    "talhao": { "id": 1, "nome": "Talhão 1", "propriedade": { "id": 1 } }
  },
  "ultimaLeitura": {
    "id": 10,
    "sensor_id": 1,
    "data_hora": "2026-10-12T12:00:00.000Z",
    "temperatura": 28.5,
    "umidade": 65,
    "umidade_solo": 42,
    "luminosidade": 1200,
    "precipitacao": 0
  }
}
```

`ultimaLeitura` pode ser `null`; trate esse caso como “sem leituras”. A rota inclui também sensores inativos.

Alertas possuem `id`, `medicao_id`, `tipo`, `nivel`, `titulo`, `descricao`, `data_hora`, `visualizado` e `status`. Os tipos gerados são `TEMPERATURA_ALTA`, `TEMPERATURA_BAIXA`, `UMIDADE_ALTA` e `UMIDADE_BAIXA`; os níveis são `CRITICO` e `ALERTA`. Marcar como visto mantém o alerta ativo.

## Exemplo com fetch

```js
const API_URL = 'http://localhost:3000';

async function api(path, options = {}) {
  const response = await fetch(API_URL + path, options);
  const data = await response.json();

  if (!response.ok) {
    const message = Array.isArray(data.message)
      ? data.message.join('; ')
      : data.message;
    throw new Error(message || `Erro HTTP ${response.status}`);
  }

  return data;
}

const [sensores, alertas] = await Promise.all([
  api('/readings/latest'),
  api('/alerts/active'),
]);

const filtros = new URLSearchParams({ sensorId: '1', limit: '50' });
const historico = await api(`/readings?${filtros}`);

await api('/devices/1/status', {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ status: 'inativo' }),
});

await api('/alerts/1/view', { method: 'PATCH' });
```

## Erros e integração no navegador

Erros tratados seguem o formato `{ statusCode, message, error }`.

| Código | Situação |
| --- | --- |
| 400 | Dados inválidos, código duplicado, status inválido ou sensor inativo. |
| 401 | Chave ausente/inválida no POST /readings. |
| 404 | Dispositivo, sensor, talhão ou alerta não encontrado. |
| 503 | Conexão recusada pelo banco ao registrar leitura. |
| 500 | Falha interna não tratada. |

O backend atualmente não habilita CORS em `backend/src/main.ts`. Para chamar de outra origem no navegador, configure um proxy no frontend ou habilite CORS no backend. As demais rotas acima não possuem autenticação implementada. Não há endpoints de login, propriedades ou talhões; os IDs vêm de dados já existentes, e as relações podem ser consultadas em `/devices`.

## Integração ThingSpeak

| Método | Rota | Retorno / efeito |
| --- | --- | --- |
| GET | `/thingspeak/dados` | Objeto do ThingSpeak com `channel` e `feeds` (último registro); field1 = temperatura, field2 = umidade. |
| GET | `/thingspeak/dispositivos` | Dispositivos sem relações; prefira /devices para as telas. |
| GET | `/thingspeak/enviar?temperatura=28.5&umidade=65` | Envia dados ao ThingSpeak; retorna channelId, respostaThingSpeak, temperatura e umidade. |
| GET | `/thingspeak/salvar` | Grava a última leitura no sensor de ID 1; retorna mensagem e medicao. |

As rotas `enviar` e `salvar` alteram dados apesar de usarem GET; evite chamadas automáticas, prefetch ou polling nelas. `salvar` exige o sensor 1 existente e não passa pela geração de alertas de POST /readings.

