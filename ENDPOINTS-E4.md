# E4 — Culturas e lotes

Todas as rotas exigem `Authorization: Bearer <token>`. Consultas aceitam ADMIN e COMUM; cadastro e edição exigem ADMIN.

## Culturas

- `POST /culturas`
- `GET /culturas`
- `GET /culturas/:id`
- `PATCH /culturas/:id`

## Lotes

- `POST /lotes`
- `GET /lotes?propriedade_id=1`
- `GET /lotes/:id`
- `PATCH /lotes/:id`

O lote usa `Talhao`, o plantio usa `Talhao_Cultura` e a previsão usa `Colheita`. Cadastro é transacional. O PATCH não permite substituir cultura nem data de um plantio existente; para preservar o histórico, um novo ciclo deverá ser implementado separadamente. A previsão pode ser ajustada enquanto a colheita não tiver `data_realizada`.

## Carga inicial

A rotina `npm run seed:culturas:e4` não executa sem confirmação e não sobrescreve culturas existentes. Considera qualquer cultura cujo nome contenha `Uva` como atendimento da carga de uva.

Execução manual, apenas quando a gravação estiver autorizada:

```powershell
$env:SEED_CULTURAS_E4_CONFIRMAR="sim"
try { npm run seed:culturas:e4 } finally { Remove-Item Env:SEED_CULTURAS_E4_CONFIRMAR }
```
