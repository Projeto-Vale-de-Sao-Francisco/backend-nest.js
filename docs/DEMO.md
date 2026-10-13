# SIVALE — Roteiro da demo e checklist (1ª entrega · 13/10/2026)

Objetivo: mostrar o fluxo **coleta → API → banco → dashboard** funcionando de ponta a ponta.

## Preparação (10 min antes)

1. Banco: `cd api && npm run db:dev` (Postgres local) ou o seu Postgres em `DATABASE_URL`.
2. Dados: `npx prisma migrate deploy && npx prisma db seed` (só na primeira vez).
3. API: `npm run build && npm run start:prod` (porta 3333).
4. Front: `cd frontend && npm run dev` (porta 5173).
5. Simulador em outro terminal: `cd api && npm run simulate -- loop` (uma leitura por dispositivo a cada 30 s; 10 % fora da faixa).
6. Abra `http://localhost:5173` e `http://localhost:3333/docs`.

Logins de teste (senha no README): administrador, gestor, técnico e agricultor. Só o administrador cadastra; os demais consultam.

## Roteiro (≈ 8 min)

| # | Passo | O que mostrar | Req. |
|---|---|---|---|
| 1 | Login como administrador | Rota protegida: sem login, volta para a tela de entrada | 2 |
| 2 | **Mapa** | Talhões coloridos por alerta, sensores, minimapa, card do talhão com leitura e recomendação | 12, 13 |
| 3 | **Painéis → Por talhão (T1)** | Cards verde/vermelho pela faixa da cultura, "última leitura há N min", gráfico 24 h com faixa ideal | 12, 13 |
| 4 | Deixe o simulador rodar até gerar um valor fora da faixa | O cartão fica vermelho e aparece alerta (mensagem legível) | 14 |
| 5 | **Painéis → T2** | Alertas por tipo/status e por dispositivo; observação separa condição do talhão × falha de sensor | 14 |
| 6 | **Painéis → Propriedade (P2)** | Mapa de tiles e ranking com score | 14 |
| 7 | **Alertas** | Marcar como resolvido; o contador do sino cai | 14 |
| 8 | **Dispositivos** | Última leitura por dispositivo, "Gerar chave", cadastro de um novo | 7, 9 |
| 9 | **Cadastros** | Empresas, propriedades (latitude/longitude), culturas, talhões | 3–6 |
| 10 | **Mercado → Atualizar valores** e **Logística** | Botão busca os valores e grava; cadastro logístico | 10, 11 |
| 11 | Login como **agricultor** (e **gestor**) | Agricultor vê só a propriedade vinculada; gestor vê as da empresa; ninguém além do administrador vê formulários, Usuários nem Empresas | 2 |
| 11b | **Usuários** (administrador) | Cadastrar usuário, escolher o perfil e vincular a empresa/propriedade; o novo usuário passa a ver só o vinculado | 1, 2 |
| 11c | **Histórico** | Filtros de propriedade, talhão, cultura, dispositivo e período; gráficos de temperatura e umidade com a faixa ideal | 13 |
| 12 | Swagger `/docs` e celular (modo responsivo) | Documentação da API e o app instalável (PWA) | 15, 16 |

Demonstração opcional do hardware: `curl -X POST .../ingest/medicoes -H "x-device-key: <chave>" -d '{"temperatura":41,"umidade":20}'` e mostrar o alerta nascendo.

## Checklist de testes manuais

**Autenticação e perfis**
- [ ] Acessar `/` sem login redireciona para `/login`.
- [ ] Credencial errada mostra erro; a certa entra.
- [ ] Agricultor e técnico veem só as propriedades vinculadas e nenhum formulário de cadastro; Usuários e Empresas não aparecem no menu.
- [ ] Gestor vê todas as propriedades da empresa vinculada e também não cadastra.
- [ ] Administrador cria usuário, escolhe o perfil e vincula a empresa/propriedade; o usuário novo entra e vê só o vinculado.
- [ ] Qualquer perfil marca um alerta como resolvido.
- [ ] Sair e entrar novamente mantém os dados.

**Cadastros**
- [ ] Criar empresa; CPF/CNPJ repetido é recusado.
- [ ] Criar propriedade com latitude, longitude e área.
- [ ] Criar talhão; área acima da propriedade é recusada.
- [ ] Criar dispositivo e copiar a chave exibida.

**Ingestão e alertas**
- [ ] Leitura dentro da faixa não gera alerta.
- [ ] Leitura fora da faixa gera alerta com texto legível (ex.: "Temperatura acima do recomendado para o talhão ...").
- [ ] A mesma leitura fora da faixa não duplica o alerta.
- [ ] Temperatura 999 ou umidade 150 são recusadas (400).
- [ ] Dispositivo inativo recusa leitura (422).
- [ ] Parar o simulador por mais de 30 min cria "Dispositivo sem comunicação" (ou `POST /alertas/verificar-comunicacao`).

**Dashboards**
- [ ] Mapa mostra o talhão e abre o card ao clicar.
- [ ] T1 mostra o semáforo correto; sem leituras mostra aviso de dados desatualizados.
- [ ] T2 e P2 batem com a lista de Alertas.
- [ ] Filtros por propriedade e talhão funcionam.

**Responsividade e PWA**
- [ ] Em tela de celular: barra de navegação inferior e tabelas viram cartões.
- [ ] O navegador oferece "instalar app" (manifest + service worker).

**Automatizado**
- [ ] `cd api && npm run smoke` com a API no ar: todas as verificações em OK.
- [ ] `cd api && npm run build` e `cd frontend && npm run build` sem erros.
