# Resultado dos testes dos endpoints — 12/10/2026

## Integração com a main

A migração inicial duplicada 20261012000000_baseline foi substituída pela migração inicial oficial da main, 20261011224616_init. A migração de pressão permanece. Para bancos locais que já registraram a baseline antiga, é necessário reconciliar o histórico e o schema de usuários antes de executar migrate deploy; não execute o SQL inicial sobre tabelas existentes.

## Verificação após as correções

**54 verificações HTTP aprovadas, sem divergências**, na API local com banco real.
As 12 falhas descritas no diagnóstico abaixo foram corrigidas e retestadas.
A compilação final passou, assim como os 20 testes unitários e os 15 testes de integração HTTP.
Os dados exclusivos de teste foram removidos ao final.

- Entradas inválidas passaram a retornar HTTP 400, incluindo corpos com tipos incorretos e queries inválidas.
- Leituras de dispositivo ou sensor inativo são rejeitadas nos dois modos de identificação.
- Nenhum sensor substituto é criado durante a ingestão.
- Pressão é armazenada e retornada no campo opcional pressao, em hPa.
- Status do dispositivo e sensores é atualizado dentro de uma transação.
- A migração inicial foi comparada ao banco (sem diferenças) e registrada como aplicada; a migração aditiva de pressão foi aplicada.
- A suíte e2e foi substituída por testes das rotas efetivamente registradas e das entradas inválidas.

Comandos para outros ambientes:
`npm install`, `npx prisma migrate deploy`, `npx prisma generate` e `npm run build`.
Em bancos já preenchidos sem histórico de migração, conferir o schema e registrar a migração inicial como aplicada antes do deploy; não executar o SQL inicial sobre tabelas existentes.

## Diagnóstico anterior às correções (histórico)


API testada por HTTP em http://localhost:3000, com banco real e dados existentes.
Foram criados dispositivo, sensores, medições e alertas exclusivos para teste.
Ao final, todos esses registros foram removidos em transação; registros anteriores foram preservados.
As sequências de IDs do banco podem apresentar saltos após os testes.

## Resultado

- **54 verificações de contrato/comportamento: 42 passaram e 12 falharam.**
- **Testes unitários existentes:** 7 arquivos, 17 testes aprovados.
- **Teste e2e existente:** 1 falha. GET / retorna 404, mas o teste espera 200 e "Hello World!".
- Comandos: `npm.cmd test -- --reporter=dot` e `npm.cmd run test:e2e -- --reporter=dot`.

## Comportamentos confirmados

| Área | Verificações aprovadas |
| --- | --- |
| Cadastro | HTTP 201, sensor padrão associado, relações de talhão/propriedade; código duplicado 400; talhão inexistente 404; propriedade inconsistente 400; código ausente 400. |
| Dispositivos | Consulta por ID; inexistente 404; ID não numérico 400; filtros combinados propriedade/talhão/status; alias lote; status inválido no filtro 400. |
| Status | Inativação e reativação refletidas nos sensores; status textual inválido 400. |
| Autenticação | Chave ausente/incorreta 401; x-api-key e x-device-token válidos aceitos. |
| Leituras | HTTP 201 por sensorId e codigoDispositivo; persistência de umidadeSolo, luminosidade e precipitacao; sensor inexistente 404; identificação ausente 400. |
| Plausibilidade | Temperatura acima/abaixo da faixa, umidade acima/abaixo da faixa, solo > 100, lux negativo, precipitação negativa, temperatura ausente e dataHora inválida retornaram 400. |
| Consultas | Histórico com filtros combinados, período e limit=1; relações de sensor/dispositivo/talhão/alertas; última leitura coerente. |
| Inativação normal | Depois do PATCH em cascata, leituras por sensorId e por codigoDispositivo foram rejeitadas com 400. |
| Alertas | Temperatura acima do máximo da cultura gerou TEMPERATURA_ALTA/CRITICO com nome da cultura na descrição; repetição imediata não gerou o mesmo alerta. |
| Monitoramento | Filtros status/visualizado/talhaoId; alerta ativo no dashboard; marcar visto preserva ativo; resolver marca visto e resolvido; resolvido deixa a lista de ativos; IDs inexistentes nos PATCH retornam 404. |

O teste de cadastro confirmou a criação conjunta no caminho de sucesso. Não foi injetada uma falha de banco para testar rollback. A atomicidade é indicada pela escrita aninhada do Prisma no código.

## As 12 divergências

Nos exemplos de escrita, substitua IDs pelos de um dispositivo/sensor exclusivo de teste.
POST /readings exige a chave configurada em DEVICE_API_KEY.

| # | Requisição / cenário | Esperado | Observado |
| --- | --- | --- | --- |
| 1 | POST /readings com pressao: 1013 | Pressão persistida e retornada | 201, mas campo ausente; o schema de Medicao não possui pressao. |
| 2 | PATCH /devices/:id/status com {} | 400 | 500 Internal server error. |
| 3 | POST /devices com codigo: 123 | 400 | 500 Internal server error. |
| 4 | POST /readings com temperatura: "25" | 400, conforme DTO numérico | 500 Internal server error. |
| 5 | GET /readings?limit=abc | 400 | 200; limite inválido ignorado. |
| 6 | GET /readings?limit=1.5 | 400 | 200; retornou uma medição. |
| 7 | GET /readings?dataInicio=invalida | 400 | 500 Internal server error. |
| 8 | GET /readings?sensorId=abc | 400 | 200; filtro inválido ignorado. |
| 9 | GET /devices?talhaoId=abc | 400 | 200; filtro inválido ignorado. |
| 10 | GET /alerts?visualizado=banana | 400 | 200; valor tratado como false. |
| 11 | Dispositivo inativo, sensor ativo; POST /readings via sensorId | 400 | 201; medição vinculada a dispositivo inativo. |
| 12 | Dispositivo ativo, seu sensor inativo; POST /readings via codigoDispositivo | 400 | 201; criou outro sensor ativo e aceitou a medição. |

Para os cenários 11 e 12, os estados divergentes foram preparados diretamente no banco **somente nos registros exclusivos de teste**. O PATCH normal mantém os estados alinhados; os testes avaliaram a garantia de integridade da ingestão mesmo diante de estados divergentes.

### Exemplos de entradas inválidas

```http
PATCH /devices/:id/status
Content-Type: application/json

{}
```

```json
{
  "codigo": 123,
  "modelo": "TEST-DHT22",
  "talhaoId": 1
}
```

```json
{
  "sensorId": 1,
  "temperatura": "25",
  "umidade": 60
}
```

Os três exemplos retornaram:
```json
{ "statusCode": 500, "message": "Internal server error" }
```

## Causas identificadas no código e ajustes recomendados

1. **Validação de entrada:** main.ts não registra ValidationPipe. Os decorators dos DTOs não são executados na entrada HTTP. Habilitar validação e manter DTOs como classes em runtime; as dependências class-validator/class-transformer devem estar declaradas no pacote.
2. **Queries:** os controllers usam Number(...) sem validar inteiros positivos; NaN acaba ignorado por condições de truthiness. Validar IDs/limit, datas e booleanos antes de consultar o Prisma.
3. **Dispositivo inativo via sensorId:** ReadingsService consulta o dispositivo, mas nesse caminho verifica apenas o status do sensor. Validar ambos antes de gravar.
4. **Sensor inativo via código:** quando não encontra sensor ativo, o serviço cria outro, inclusive quando já existem sensores inativos. Diferenciar ausência de sensor de sensor inativado.
5. **Pressão:** acrescentar o campo ao schema, migração e persistência, ou ajustar o requisito e DTO para refletir o contrato efetivamente suportado.
6. **E2E desatualizado:** AppModule não registra AppController; adequar o teste à API atual ou registrar a rota se ela for necessária.

Observação de revisão, não falha reproduzida: a atualização em cascata faz updateMany de sensores e update de dispositivo em operações separadas. Uma transação evitaria estados parciais se a segunda operação falhar.

## Limites desta verificação

Não foram testados o loop do simulador, ThingSpeak, falhas de infraestrutura, concorrência, rollback forçado nem espera real de 30 minutos.
A prevenção de repetição foi confirmada por duas leituras consecutivas; os outros tipos de alerta e os extremos exatos das faixas não foram exercitados nesta rodada.

Este diagnóstico histórico descreve a versão anterior às correções; os resultados atuais estão no início do documento.

