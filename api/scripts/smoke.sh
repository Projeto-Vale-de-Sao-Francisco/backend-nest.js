#!/usr/bin/env bash
# Fluxo ponta a ponta contra a API rodando em $API (padrao http://localhost:3333). Requer migrations e seed aplicados.
API="${API:-http://localhost:3333}"
falhas=0
j() { node -pe "const d=JSON.parse(require('fs').readFileSync(0,'utf8'));$1"; }
ok() { if [ "$2" = "$3" ]; then echo "OK   $1"; else echo "FALHA $1 (esperado=$3 obtido=$2)"; falhas=$((falhas+1)); fi; }
login() { curl -s -X POST "$API/auth/login" -H 'Content-Type: application/json' -d "{\"email\":\"$1\",\"senha\":\"${2:-123456}\"}" | j 'd.token'; }
# code METODO TOKEN CAMINHO [CORPO]  -> codigo HTTP
code() { curl -s -o /dev/null -w "%{http_code}" -X "$1" "$API$3" -H "Authorization: Bearer $2" -H 'Content-Type: application/json' ${4:+-d "$4"}; }
body() { curl -s -H "Authorization: Bearer $1" "$API$2"; }
post() { curl -s -X POST "$API$2" -H "Authorization: Bearer $1" -H 'Content-Type: application/json' -d "$3"; }
# ing CHAVE CORPO -> corpo da resposta ; ingc CHAVE CORPO -> codigo HTTP
ing() { curl -s -X POST "$API/ingest/medicoes" -H "x-device-key: $1" -H 'Content-Type: application/json' -d "$2"; }
ingc() { curl -s -o /dev/null -w "%{http_code}" -X POST "$API/ingest/medicoes" -H "x-device-key: $1" -H 'Content-Type: application/json' -d "$2"; }

echo "== Autenticacao =="
ok "sem token => 401" "$(curl -s -o /dev/null -w '%{http_code}' $API/propriedades)" 401
ok "login invalido => 401" "$(curl -s -o /dev/null -w '%{http_code}' -X POST $API/auth/login -H 'Content-Type: application/json' -d '{"email":"admin@sivale.com.br","senha":"x"}')" 401
ok "campo desconhecido no corpo => 400" "$(curl -s -o /dev/null -w '%{http_code}' -X POST $API/auth/login -H 'Content-Type: application/json' -d '{"email":"a@b.com","senha":"x","hack":1}')" 400
ok "autocadastro publico nao existe => 404" "$(curl -s -o /dev/null -w '%{http_code}' -X POST $API/auth/cadastro -H 'Content-Type: application/json' -d '{}')" 404

ADM=$(login admin@sivale.com.br); GES=$(login gestor@sivale.com.br); TEC=$(login tecnico@sivale.com.br); AGR=$(login carlos@sivale.com.br)
ok "token admin emitido" "$([ -n "$ADM" ] && echo sim)" sim
ok "/auth/me traz perfil e vinculos" "$(body $AGR /auth/me | j 'd.perfil+"/"+Array.isArray(d.propriedades)+"/"+Array.isArray(d.empresas)')" "AGRICULTOR/true/true"
ok "/auth/me nao expoe senha" "$(body $AGR /auth/me | j 'JSON.stringify(d).includes("senha")')" false

echo "== Escopo de visibilidade =="
ok "admin ve todas as propriedades" "$(body $ADM /propriedades | j 'd.length')" 2
ok "gestor ve as propriedades da empresa (Usuario_Empresa)" "$(body $GES /propriedades | j 'd.length')" 2
ok "tecnico ve so as vinculadas" "$(body $TEC /propriedades | j 'd.length')" 1
ok "agricultor ve so as vinculadas" "$(body $AGR /propriedades | j 'd.length')" 1
ok "agricultor nao abre propriedade alheia => 404" "$(code GET $AGR /propriedades/2)" 404
ok "tecnico nao ve talhao de outra propriedade => 404" "$(code GET $TEC /talhoes/3)" 404
ok "tecnico e agricultor veem os mesmos talhoes" "$(body $TEC /talhoes | j 'd.map(x=>x.id).join()')" "$(body $AGR /talhoes | j 'd.map(x=>x.id).join()')"
ok "agricultor ve culturas e mercado (consulta)" "$(code GET $AGR /culturas)$(code GET $AGR /mercado)$(code GET $AGR /logistica)" 200200200

echo "== Escrita so do administrador =="
for papel in GES TEC AGR; do
  t=${!papel}
  ok "$papel nao cria usuario => 403" "$(code POST $t /usuarios '{"nomeCompleto":"X Y","cpf":"99999999999","email":"x@y.com","senha":"123456","perfil":"AGRICULTOR"}')" 403
  ok "$papel nao cria empresa => 403" "$(code POST $t /empresas '{"razaoSocial":"X","cpfCnpj":"11111111000111"}')" 403
  ok "$papel nao cria propriedade => 403" "$(code POST $t /propriedades '{"nome":"X","localizacao":"Y"}')" 403
  ok "$papel nao cria cultura => 403" "$(code POST $t /culturas '{"nome":"X","temperaturaMin":1,"temperaturaMax":2,"umidadeMin":1,"umidadeMax":2}')" 403
  ok "$papel nao cria talhao => 403" "$(code POST $t /talhoes '{"propriedadeId":1,"nome":"X"}')" 403
  ok "$papel nao cria dispositivo => 403" "$(code POST $t /dispositivos '{"talhaoId":1,"codigo":"X-1","nome":"X"}')" 403
  ok "$papel nao cadastra mercado => 403" "$(code POST $t /mercado '{"culturaId":1,"mercadoDestino":"X","precoMedio":1,"dataReferencia":"2026-10-01"}')" 403
  ok "$papel nao atualiza mercado => 403" "$(code POST $t /mercado/atualizar)" 403
  ok "$papel nao cadastra logistica => 403" "$(code POST $t /logistica '{"propriedadeId":1,"origem":"A","destino":"B","modal":"x"}')" 403
  ok "$papel sem acesso as telas de usuarios e empresas => 403" "$(code GET $t /usuarios)$(code GET $t /empresas)" 403403
done
ok "senha nunca vaza no /usuarios" "$(body $ADM /usuarios | j 'JSON.stringify(d).includes("senha")')" false

echo "== Usuarios e vinculos (admin) =="
EMAIL="teste$(date +%s)@sivale.com.br"
NOVO=$(post $ADM /usuarios "{\"nomeCompleto\":\"Teste Smoke\",\"cpf\":\"$(date +%s)00\",\"email\":\"$EMAIL\",\"senha\":\"123456\",\"perfil\":\"AGRICULTOR\"}")
NID=$(echo "$NOVO" | j 'd.id')
ok "admin cria usuario" "$([ -n "$NID" ] && [ "$NID" != undefined ] && echo sim)" sim
ok "CPF/e-mail repetido => 409" "$(code POST $ADM /usuarios "{\"nomeCompleto\":\"Dup Dup\",\"cpf\":\"11111111111\",\"email\":\"$EMAIL\",\"senha\":\"123456\",\"perfil\":\"AGRICULTOR\"}")" 409
NTOK=$(login "$EMAIL")
ok "usuario sem vinculo nao ve propriedades" "$(body $NTOK /propriedades | j 'd.length')" 0
ok "admin vincula usuario a propriedade" "$(code POST $ADM /usuarios/$NID/propriedades '{"propriedadeId":2}')" 201
ok "usuario passa a ver a propriedade vinculada" "$(body $NTOK /propriedades | j 'd.map(p=>p.id).join()')" 2
ok "admin remove o vinculo" "$(code DELETE $ADM /usuarios/$NID/propriedades/2)" 200
ok "usuario volta a nao ver nada" "$(body $NTOK /propriedades | j 'd.length')" 0
ok "admin vincula usuario a empresa" "$(code POST $ADM /usuarios/$NID/empresas '{"empresaId":1}')" 201
code PATCH $ADM /usuarios/$NID '{"status":"INATIVO"}' >/dev/null
ok "usuario inativo nao entra => 401" "$(curl -s -o /dev/null -w '%{http_code}' -X POST $API/auth/login -H 'Content-Type: application/json' -d "{\"email\":\"$EMAIL\",\"senha\":\"123456\"}")" 401
ok "admin nao inativa a propria conta => 403" "$(code PATCH $ADM /usuarios/$(body $ADM /auth/me | j 'd.id') '{"status":"INATIVO"}')" 403

echo "== Leituras: so por chave de dispositivo =="
ok "nao existe POST /medicoes (nenhum perfil registra leitura)" "$(code POST $ADM /medicoes '{"temperatura":25,"umidade":50}')" 404
D1=$(body $ADM /dispositivos | j 'd.find(x=>x.codigo=="ESP32-01").id')
D2=$(body $ADM /dispositivos | j 'd.find(x=>x.codigo=="ESP32-02").id')
K1=$(post $ADM /dispositivos/$D1/chave '{}' | j 'd.chaveApi')
K2=$(post $ADM /dispositivos/$D2/chave '{}' | j 'd.chaveApi')
ok "chave emitida (prefixo sv_)" "$(echo "$K1" | cut -c1-3)" sv_
ok "ingest sem chave => 401" "$(curl -s -o /dev/null -w '%{http_code}' -X POST $API/ingest/medicoes -H 'Content-Type: application/json' -d '{"temperatura":25,"umidade":50}')" 401
ok "ingest chave errada => 401" "$(ingc sv_errada '{"temperatura":25,"umidade":50}')" 401
ok "gestor nao gera chave => 403" "$(code POST $GES /dispositivos/$D1/chave)" 403
ok "temperatura implausivel => 400" "$(ingc $K1 '{"temperatura":999,"umidade":50}')" 400
ok "umidade acima de 100 => 400" "$(ingc $K1 '{"temperatura":30,"umidade":150}')" 400

for id in $(body $ADM "/alertas?resolvido=false" | j 'd.map(a=>a.id).join(" ")'); do code PATCH $ADM /alertas/$id/resolver >/dev/null; done
ANTES=$(body $ADM "/alertas?resolvido=false" | j 'd.length')
ok "leitura fora da faixa gera 2 alertas" "$(ing $K1 '{"temperatura":41,"umidade":5}' | j 'd.alertasGerados')" 2
ok "alertas pendentes +2" "$(( $(body $ADM "/alertas?resolvido=false" | j 'd.length') - ANTES ))" 2
ok "mesma leitura nao repete alerta" "$(ing $K1 '{"temperatura":41,"umidade":5}' | j 'd.alertasGerados')" 0
ok "leitura dentro da faixa nao gera alerta" "$(ing $K1 '{"temperatura":27,"umidade":50}' | j 'd.alertasGerados')" 0
ok "alerta mostra cultura do talhao" "$(body $ADM "/alertas?resolvido=false" | j 'd.every(a=>a.talhao.cultura&&a.talhao.cultura.nome)')" true

code PATCH $ADM /dispositivos/$D2 '{"status":"INATIVO"}' >/dev/null
ok "dispositivo inativo recusa leitura => 422" "$(ingc $K2 '{"temperatura":25,"umidade":50}')" 422
code PATCH $ADM /dispositivos/$D2 '{"status":"ATIVO"}' >/dev/null
ok "dispositivo reativado aceita leitura => 201" "$(ingc $K2 '{"temperatura":25,"umidade":50}')" 201

echo "== Alertas: todos os perfis tratam =="
AID=$(body $AGR "/alertas?resolvido=false" | j 'd[0].id')
ok "agricultor marca alerta como visto" "$(code PATCH $AGR /alertas/$AID/visualizar)" 200
ok "agricultor marca alerta como resolvido" "$(code PATCH $AGR /alertas/$AID/resolver)" 200
ok "alerta resolvido sai dos pendentes" "$(body $AGR "/alertas?resolvido=false" | j 'd.some(a=>a.id=='$AID')')" false
ok "tecnico nao mexe em alerta de outra propriedade => 404" "$(code PATCH $TEC "/alertas/$(body $ADM '/alertas?propriedadeId=2' | j 'd[0]?.id ?? 999999')/resolver")" 404

echo "== Dashboards e demais regras =="
ok "dashboard resumo responde" "$(code GET $ADM /dashboard/resumo)" 200
ok "dashboard mostra temperaturaAtual" "$(body $ADM /dashboard/resumo | j 'typeof d.temperaturaAtual')" number
ok "T1 saude do talhao responde" "$(code GET $ADM /dashboard/talhao/1/saude)" 200
ok "T1 semaforo valido" "$(body $ADM /dashboard/talhao/1/saude | j '["ok","acima","abaixo","sem-faixa"].includes(d.semaforo.temperatura)')" true
ok "T1 agricultor nao ve talhao de outra propriedade => 404" "$(code GET $AGR /dashboard/talhao/3/saude)" 404
ok "T2 total = pendentes + resolvidos" "$(body $ADM /dashboard/talhao/1/alertas | j 'd.total===d.pendentes+d.resolvidos')" true
ok "P2 ranking ordenado por score" "$(body $ADM /dashboard/propriedade/1/ranking-alertas | j 'd.itens.every((x,i,a)=>i===0||a[i-1].score>=x.score)')" true
ok "P2 agricultor nao ve propriedade alheia => 404" "$(code GET $AGR /dashboard/propriedade/2/ranking-alertas)" 404
ok "medicoes paginadas" "$(body $ADM '/medicoes?limite=2&pagina=1' | j 'd.dados.length+"/"+(d.total>2)+"/"+d.pagina')" "2/true/1"
ok "historico aceita filtro por dispositivo" "$(body $ADM "/dashboard/historico?dispositivoId=$D1" | j 'd.length>0&&d.every(x=>x.dispositivoId==='$D1')')" true
ok "dispositivos trazem ultima medicao" "$(body $ADM /dispositivos | j 'd.every(x=>"ultimaMedicao" in x)')" true
ok "lista de dispositivos nao expoe hash da chave" "$(body $ADM /dispositivos | j 'JSON.stringify(d).includes("chaveApiHash")')" false
ok "verificar comunicacao (admin) => 200" "$(code POST $ADM /alertas/verificar-comunicacao)" 200
ok "agricultor nao verifica comunicacao => 403" "$(code POST $AGR /alertas/verificar-comunicacao)" 403
ok "CPF/CNPJ de empresa duplicado => 409" "$(code POST $ADM /empresas '{"razaoSocial":"Outra","cpfCnpj":"12345678000199"}')" 409
ok "talhao acima da area da propriedade => 400" "$(code POST $ADM /talhoes '{"propriedadeId":1,"nome":"Gigante","area":99999}')" 400
POST_MERCADO=$(post $ADM /mercado/atualizar '{}')
ok "botao Atualizar mercado grava valores (admin)" "$(echo "$POST_MERCADO" | j 'd.inseridos+d.atualizados>0')" true
ok "repetir a atualizacao no mesmo dia nao duplica" "$(post $ADM /mercado/atualizar '{}' | j 'd.inseridos')" 0
ok "swagger /docs responde" "$(curl -s -o /dev/null -w '%{http_code}' $API/docs)" 200

echo; [ $falhas -eq 0 ] && echo "TUDO OK" || echo "$falhas falha(s)"; exit $falhas
