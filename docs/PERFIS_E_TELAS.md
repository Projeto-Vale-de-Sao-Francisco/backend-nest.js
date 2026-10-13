# SIVALE — Perfis de acesso e telas (1ª entrega)

Implementação do documento *Perfis de acesso e telas do sistema*. A regra de visibilidade fica em um único lugar: [`api/src/common/acesso.service.ts`](../api/src/common/acesso.service.ts); a regra de escrita, em `SO_ADMIN` ([`decorators.ts`](../api/src/common/decorators.ts)) e no front em [`perfil.ts`](../frontend/src/perfil.ts).

## Regras

- Só o **Administrador** cadastra, edita e inativa. Os demais perfis consultam e marcam alertas como vistos/resolvidos.
- **Técnico** e **Agricultor** veem as mesmas telas e os mesmos dados (modo consulta). Os quatro perfis ficam guardados como valores separados em `usuario.perfil` (`ADMINISTRADOR`, `GESTOR`, `TECNICO`, `AGRICULTOR`); a separação na 2ª entrega (RBAC) é só mudar a regra.
- **Escopo de dados:** o Administrador vê tudo. O **Gestor** vê todas as propriedades das empresas a que está vinculado (`usuarioEmpresa`). **Técnico** e **Agricultor** veem só as propriedades vinculadas (`usuarioPropriedade`).
- Ninguém registra leitura. Quem envia é o simulador (ou o ESP32), autenticado por **chave de dispositivo** (`POST /ingest/medicoes`, história 6.6). Não existe `POST /medicoes`.
- Não há autocadastro: usuários são criados pelo Administrador.
- **O perfil Gestor é uma proposta** do documento (não estava no escopo da 1ª entrega); a equipe precisa validar.

## Matriz de acesso por tela

Total = ver, cadastrar, editar e inativar · Ver = consulta · Ver + marcar = consulta e marca alerta como visto/resolvido · — = sem acesso.

| Tela | Rota | Admin | Gestor | Técnico | Agricultor |
|---|---|---|---|---|---|
| Login | `/login` | Ver | Ver | Ver | Ver |
| Meu perfil e sair | `/perfil` | Ver | Ver | Ver | Ver |
| Usuários e vínculos | `/usuarios` | Total | — | — | — |
| Produtores/empresas | `/empresas` | Total | — | — | — |
| Propriedades | `/propriedades` | Total | Ver | Ver | Ver |
| Culturas | `/culturas` | Total | Ver | Ver | Ver |
| Talhões (lotes) | `/talhoes` | Total | Ver | Ver | Ver |
| Dispositivos e sensores | `/dispositivos` | Total | Ver | Ver | Ver |
| Dados de mercado | `/mercado` | Total | Ver | Ver | Ver |
| Informações logísticas | `/logistica` | Total | Ver | Ver | Ver |
| Mapa e dashboard climático | `/` | Ver | Ver | Ver | Ver |
| Painéis (T1, T2, P2) | `/paineis` | Ver | Ver | Ver | Ver |
| Histórico (gráficos com filtros) | `/historico` | Ver | Ver | Ver | Ver |
| Alertas climáticos | `/alertas` | Ver + marcar | Ver + marcar | Ver + marcar | Ver + marcar |

Quando o perfil não tem acesso, o item some do menu e a rota redireciona para o mapa; na API a resposta é `403`.

## Ações por perfil

| Ação | Admin | Gestor | Técnico | Agricultor |
|---|---|---|---|---|
| Entrar, sair e ver os próprios dados | Sim | Sim | Sim | Sim |
| Cadastrar/editar/inativar usuários e vínculos (empresa e propriedade) | Sim | Não | Não | Não |
| Cadastrar/editar empresas, propriedades, culturas, talhões, dispositivos e sensores | Sim | Não | Não | Não |
| Gerar chave de dispositivo | Sim | Não | Não | Não |
| Cadastrar/editar mercado e logística; botão **Atualizar valores** | Sim | Não | Não | Não |
| Filtros, dashboard, histórico, painéis e leituras | Sim | Sim | Sim | Sim |
| Marcar alerta como visto/resolvido | Sim | Sim | Sim | Sim |
| Consultar mercado e logística | Sim | Sim | Sim | Sim |

Os dois pontos que mais mudam ao ligar o RBAC completo na 2ª entrega são `AcessoService.propriedade()` (escopo) e `SO_ADMIN` (permissões de escrita); o ER já prevê as tabelas `Permissao` e `Usuario_Permissao` para isso.
