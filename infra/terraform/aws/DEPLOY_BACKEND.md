# Publicação e operação do backend EC2

Este procedimento é para execução posterior pelo operador. A preparação não
publica imagens, não inicia containers na EC2 e não altera Render, Aiven ou AWS.
Não executar Terraform apply/destroy para publicar uma versão da aplicação.

## Resultado da inspeção

- Contexto de build: `backend`, Dockerfile: `backend/Dockerfile.ec2`. O ignore
  específico `Dockerfile.ec2.dockerignore` substitui o `.dockerignore` nesse build;
  não há `.dockerignore` genérico. A allowlist exclui `.env`, CA, chaves, testes,
  node_modules local, Python, client Prisma local e simulador.
- `npm ci` usa o lockfile compatível com package.json; Node 24 atende Nest 12,
  Prisma 7.10 e bcrypt 6. A dependência de build Angular Devkit exige Node
  ^24.15.0 nessa linha. O build usa limite de heap de 4 GiB no runner.
- Prisma gera o client TypeScript antes do Nest compilar; `dist/generated/prisma`
  deve permanecer no runtime. Bcrypt é instalado/compilado em Linux, nunca copiado
  do Windows. O estágio final usa o mesmo Debian/Node, dependências de produção,
  OpenSSL e certificados; executa como `node` com filesystem somente leitura.
- Nenhum build recebe DATABASE_URL ou segredos; `prisma generate` não executa SQL.
  A imagem final não leva schema, migrations, seeds ou CLI Prisma.
- Foram removidas credenciais de fallback do guard IoT e serviço ThingSpeak.
  Sem DEVICE_API_KEY o guard rejeita pedidos; sem as chaves ThingSpeak a operação
  correspondente falha. Isso também afeta um futuro build Render deste código:
  configurar as variáveis antes de promovê-lo. O Render em execução não foi alterado.
  O simulador original permanece fora da imagem EC2. Rotacionar as credenciais
  anteriormente versionadas, por procedimento separado coordenado com os clientes.
- Nest escuta sem host explícito (interfaces disponíveis, não apenas loopback).
  systemd fixa PORT=3000; ambos os containers usam `sivale`, alias `backend`.
  Caddy encaminha para `backend:3000`; a unit backend não publica porta no host.

## Variáveis e certificados

| Variável | Obrigatoriedade e uso |
| --- | --- |
| JWT_SECRET | Obrigatória antes de criar o Nest; segredo forte entregue em runtime. Coordenar com Render se tokens precisarem funcionar nos dois ambientes. |
| DATABASE_URL | Necessária para conexão Prisma no bootstrap; PostgreSQL Aiven, hostname e porta corretos, usuário/senha URL-encoded e TLS validado. |
| NODE_ENV / PORT | Fixadas pela imagem/unit: production / 3000. |
| NODE_EXTRA_CA_CERTS | Fixada pela unit: /run/certs/aiven-ca.pem. CA pública em /etc/sivale/ca.pem legível pelo usuário node. |
| CORS_ORIGINS | Não bloqueia bootstrap quando vazia, mas necessária para o frontend; origens HTTPS exatas separadas por vírgulas. Valor inválido impede inicialização. |
| JWT_EXPIRES_IN | Opcional, default 1h; usar duração válida. |
| DEVICE_API_KEY | Necessária para endpoints IoT, não para bootstrap. |
| THINGSPEAK_WRITE_API_KEY / THINGSPEAK_READ_API_KEY | Necessárias nas operações de escrita/leitura ThingSpeak, não no bootstrap. |
| THINGSPEAK_CHANNEL_ID | Canal desejado; fornecer explicitamente para evitar canal padrão do código. |
| THINGSPEAK_SENSOR_ID | Necessária para importar; inteiro positivo, sensor temperatura_umidade e dispositivo ativos no banco. |
| COMEXSTAT_ESTADOS / COMEXSTAT_MESES / MERCADO_HTTP_TIMEOUT_MS / MERCADO_CACHE_TTL_MIN / MERCADO_FONTES_ATIVAS | Opcionais, possuem defaults. |

Não copiar automaticamente o `.env` local. Usar `deploy/runtime.env.example` como
lista, sem colocar valores no Git, Terraform, Dockerfile, argumentos de build ou
logs. A CA é montada read-only; usar `sslmode=verify-full`, sem desativar TLS nem
referenciar caminhos da máquina local na URL. Validar TLS Aiven na etapa operacional.

## Validacao via GitHub Actions

Recomendado: build no runner GitHub hospedado x86_64, sem usar RAM da t3.small.
Workflow `.github/workflows/backend-ec2-image.yml`: push em `feat/backend-mvp`,
Pull Request para `main` ou disparo manual, sem acesso AWS/Render/Aiven.
O job usa somente `contents: read`. Nao publica no GHCR e nao pede credenciais
de producao. Executa instalacao limpa, Prisma generate, testes unitarios e de
contrato, build NestJS e Docker Linux AMD64.

O smoke test inicia PostgreSQL descartável vazio, verifica bootstrap/GET /auth/me (401),
healthcheck, acesso pelo alias backend de outro container e bcrypt nativo. Não
executa migrations nem testa funcionalidades dependentes das tabelas ou TLS Aiven.
A rede Docker interna impede acesso externo durante o smoke test.

1. Revisar e versionar apenas os arquivos pretendidos; há alterações Terraform
   preexistentes no workspace. Disponibilizar o workflow na branch padrão para
   habilitar workflow_dispatch. Não executar os comandos abaixo nesta preparação.
2. Validar sem publicar, usando GitHub CLI autenticado no repositório:

```powershell
gh workflow run backend-ec2-image.yml --ref feat/backend-mvp
gh run list --workflow backend-ec2-image.yml --limit 5
gh run watch ID_DA_EXECUCAO --exit-status
```

3. Publicacao exige uma etapa futura separada e autorizada. Este workflow
   apenas carrega a imagem no runner e a testa; nao exporta nem publica imagens.

Nome calculado em minúsculas: `ghcr.io/OWNER/REPO/backend:sha-COMMIT_COMPLETO`.
Esse nome e usado apenas localmente no runner nesta etapa. Em uma futura
publicacao, obter o digest do registro e guardar tambem o digest anterior.

Confirmar políticas Actions/Packages da organização e acesso do repositório ao
pacote se ele já existir. Manter privado por padrão. Imagem pública permite pull
anônimo, mas exige aprovação explícita para expor o código compilado.
Para pacote privado, EC2 precisa de PAT classic com `read:packages`, acesso ao
pacote e autorização SSO quando exigida. A role AWS não autentica no GHCR.
Instalar credencial por canal protegido/credential helper para root, pois systemd
executa Docker como root. `docker login --password-stdin` pode receber o token
desse canal; nunca incluí-lo literalmente no comando, histórico ou sessão gravada.
Sem helper, Docker armazena a credencial apenas codificada em config.json: protegê-lo.

Build local alternativo, somente com daemon Linux ativo (não publica):

```powershell
docker build --platform linux/amd64 -f backend/Dockerfile.ec2 -t sivale-backend:check backend
```

## Primeiro início na EC2 (execução posterior)

Pré-requisitos: teste CI aprovado, digest publicado e acessível, credenciais de
runtime entregues com segurança, CA confiável, acesso Aiven já permitido, schema
compatível, DNS A do novo domínio apontando ao Elastic IP e ACME acessível.
Não mudar frontend ou DNS do Render nesta etapa. Não fazer smoke test que escreva
no Aiven. O backend não possui tarefas agendadas de importação no bootstrap.

Pela sessão SSM em us-east-1, instalar as versões revisadas de Caddyfile/units
em `/etc/sivale/Caddyfile` e `/etc/systemd/system/`. Não presumir que editar os
arquivos locais atualiza os arquivos já instalados. Preencher `deploy.env` com
BACKEND_IMAGE por digest, CADDY_IMAGE aprovado, BACKEND_DOMAIN e ACME_EMAIL.
Entregar runtime.env e ca.pem por canal que não registre segredos.

```sh
sudo chown root:root /etc/sivale/runtime.env /etc/sivale/deploy.env /etc/sivale/ca.pem
sudo chmod 700 /etc/sivale
sudo chmod 600 /etc/sivale/runtime.env /etc/sivale/deploy.env
sudo chmod 644 /etc/sivale/ca.pem
sudo systemctl daemon-reload
sudo -i
set -eu
# deploy.env contém somente configuração pública e valores shell compatíveis.
set -a
. /etc/sivale/deploy.env
set +a
docker pull "$BACKEND_IMAGE"
docker pull "$CADDY_IMAGE"
systemctl enable --now sivale-backend.service
for attempt in $(seq 1 60); do
  health=$(docker inspect --format '{{.State.Health.Status}}' sivale-backend 2>/dev/null || true)
  [ "$health" = healthy ] && break
  sleep 2
done
test "$health" = healthy
systemctl enable --now sivale-proxy.service
exit
curl --silent --output /dev/null --write-out '%{http_code}\n' https://api.seu-dominio.example/auth/me
```

Resultado esperado: healthy e HTTP 401 sem token. `GET /auth/me` testa processo, nao readiness
contínua do banco. `unhealthy` não reinicia automaticamente via systemd. Validar
uma leitura autenticada e CORS com origem real antes de direcionar o frontend.
Não imprimir runtime.env, docker inspect completo ou logs sem revisão de segredos.

## Atualização e rollback

1. Publicar e validar nova versão no CI. Registrar digest atual e novo digest.
2. Fazer pull do novo digest antes de interromper a versão atual.
3. Editar somente BACKEND_IMAGE no deploy.env para o novo digest; executar:

```sh
sudo systemctl restart sivale-backend.service
sudo docker inspect --format '{{.State.Health.Status}}' sivale-backend
curl --fail https://api.seu-dominio.example/
```

Se falhar, restaurar BACKEND_IMAGE para o digest anterior, fazer pull se necessário
e repetir restart/verificações. O primeiro deploy não tem digest EC2 anterior:
parar o backend/proxy se falhar e manter o tráfego no Render. Há interrupção durante
restart. Não remover volumes Caddy nem limpar imagens necessárias ao rollback.
Rollback de imagem não desfaz alterações de banco; nenhuma é prevista aqui.

## Migrations e limites da validação

Não foi alterado schema nem criada migration. Mudar hospedagem não exige migration
por si só. Existem `20261011224616_init` (inclui Usuario.token_version) e
`20261012150000_add_reading_pressure` (Medicao.pressao). Não foi consultado o Aiven:
confirmar com evidência existente ou inspeção somente leitura autorizada que ambas
e o restante do schema são compatíveis com a versão escolhida. Se houver pendências,
interromper a promoção e planejar separadamente; não executar migrate deploy,
db push, reset ou seeds como parte deste runbook.

Docker CLI existe, mas o daemon local não está disponível, inclusive na verificação
fora do sandbox. Logo, build limpo Linux, npm ci/prune e execução real da imagem
permanecem pendentes do workflow. O smoke test foi preparado, não executado no GitHub.
TLS Aiven, DNS/ACME, permissões GHCR e operação real do Caddy continuam pendentes.
`npm run build` passou localmente com heap de 4 GiB; os artefatos
dist/main.js e dist/generated/prisma/client.js foram confirmados. Os 12 testes
de src/thingspeak/importacao.spec.ts passaram, sem conexão ao banco.
O YAML foi revisado manualmente; não há parser YAML instalado nesta máquina.

Referências: [GHCR e Actions](https://docs.github.com/en/actions/tutorials/publish-packages/publish-docker-images),
[cache Docker no Actions](https://docs.docker.com/build/ci/github-actions/cache/),
[autenticação GHCR](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry).
