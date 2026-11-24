# SIVALE — NestJS na EC2 com Docker

Este módulo prepara uma EC2 separada. Não altera Render, Vercel ou Aiven;
não habilita Azure, Python ou AWS IoT Core e não executa migrations.

Para publicação via GHCR, variáveis, primeiro início, atualização e rollback, seguir
[DEPLOY_BACKEND.md](DEPLOY_BACKEND.md). O workflow é manual e não publica por padrão.

## Inspeção do backend

- `package.json`: build `nest build`, produção `node dist/main`. A imagem usa
  explicitamente `node dist/main.js`.
- Lockfile: NestJS 12.0.4 exige Node >=20; Prisma/Client 7.10.0 exige Node
  ^20.19, ^22.12 ou >=24; bcrypt 6 exige Node >=18. A imagem usa Node 24,
  Debian Bookworm, OpenSSL e CA certificates. Compiladores ficam no estágio de build.
- Não havia Dockerfile ou Compose. `Dockerfile.ec2` tem nome separado para preservar
  a descoberta de Dockerfile na implantação Render. Duas units systemd supervisionam
  os containers; Compose não é necessário para esta configuração.
- Prisma usa PostgreSQL via `@prisma/adapter-pg`, `DATABASE_URL` e client gerado
  em `src/generated/prisma`. `prisma.config.ts` aponta para o schema/migrations.
  O build gera o client antes de compilar, sem acessar ou modificar o banco.
- Migrations existentes: `20261011224616_init` e
  `20261012150000_add_reading_pressure`. Confirmar compatibilidade com o schema Aiven.
  Nenhum seed, migrate, db push ou db pull é executado pelo Docker/Terraform.
- CORS existente: origens explícitas em `CORS_ORIGINS`, separadas por vírgula;
  em produção não adiciona localhost. Informar a origem HTTPS exata da Vercel,
  sem caminho. CORS não substitui autenticação nem restringe clientes IoT.
- `GET /` retorna `Hello World!` e é usado como teste de vida Docker. O Prisma
  conecta ao iniciar, mas esse endpoint não testa continuamente o banco. Não existe
  endpoint dedicado de readiness. Systemd reinicia processos encerrados; o status
  Docker `unhealthy`, isoladamente, exige intervenção e não dispara reinício.

Variáveis do backend identificadas (somente nomes):

| Grupo | Nomes |
| --- | --- |
| Inicialização/conexão | `DATABASE_URL`, `JWT_SECRET`, `NODE_ENV`, `PORT` |
| Autenticação/CORS | `JWT_EXPIRES_IN`, `DEVICE_API_KEY`, `CORS_ORIGINS` |
| ThingSpeak | `THINGSPEAK_CHANNEL_ID`, `THINGSPEAK_WRITE_API_KEY`, `THINGSPEAK_READ_API_KEY`, `THINGSPEAK_SENSOR_ID` |
| Mercado, com defaults no código | `COMEXSTAT_ESTADOS`, `COMEXSTAT_MESES`, `MERCADO_HTTP_TIMEOUT_MS`, `MERCADO_CACHE_TTL_MIN`, `MERCADO_FONTES_ATIVAS` |

`JWT_SECRET` é obrigatória no bootstrap, e `DATABASE_URL` é necessária para a conexão.
Para importação ThingSpeak, o sensor configurado deve existir e estar ativo no banco.
Não executar simulador na EC2. Ele usa também `API_URL`, `THINGSPEAK_DEVICE`,
`SIMULATOR_INTERVAL_SECONDS` e `SIMULATOR_LOCAL_API`, além das chaves de integração.

Os fallbacks de credenciais IoT/ThingSpeak foram removidos do guard e serviço.
Fornecer as chaves em runtime antes de promover este código, inclusive em futuro
build Render. O simulador fica fora do build EC2. Ver detalhes no runbook.

## Arquitetura e custos

VPC dedicada, subnet pública, Internet Gateway, rota de saída, EC2 x86_64 Amazon
Linux 2023, Elastic IP e disco gp3 criptografado. Sem NAT Gateway, balanceador,
banco, chave SSH ou porta 22. Somente TCP 80 (ACME/redirecionamento) e 443 entram.
A porta 3000 fica apenas na rede Docker. Saída IPv4 é liberada para SSM,
registries, Aiven (porta própria) e APIs externas. Nenhum PostgreSQL é exposto.

IMDSv2 é obrigatório, com hop limit 1. A role da instância permite somente registro
SSM e canais Session Manager, conforme a política mínima oficial. Não permite
leitura de Parameter Store/Secrets Manager, ECR privado, Run Command ou acesso ao banco.
O operador precisa de permissões próprias de sessão. Usar agente SSM recente da AMI
oficial; funcionalidades adicionais de SSM exigem permissões adicionais deliberadas.

EC2, disco, IPv4 público e tráfego são cobrados; não assumir free tier. CPU credits
em modo `standard` evitam excedentes cobrados, mas podem limitar desempenho.
Uma única instância não fornece alta disponibilidade, backup ou deploy sem interrupção.
Logs Docker têm rotação local, sem envio para CloudWatch nesta etapa.

## Autenticação e plano

Requisitos: Terraform >=1.6 e <2, AWS CLI v2, plugin Session Manager, conta AWS
habilitada e Docker com daemon ativo para compilar a imagem. Preferir IAM Identity
Center/SSO ou credenciais temporárias. Não usar root nem colocar access keys em
Terraform, tfvars, backend config ou user_data.

```powershell
aws configure sso --profile sivale
aws sso login --profile sivale
$env:AWS_PROFILE = 'sivale'
aws sts get-caller-identity
```

O provisionador precisa consultar a AMI pública via SSM e gerenciar os recursos
EC2/VPC/EIP e IAM definidos, incluindo `iam:PassRole` para a role EC2. Conferir
conta/região e permissões com o administrador antes de provisionar.

Na pasta `infra/terraform/aws`:

```powershell
Copy-Item terraform.tfvars.example terraform.tfvars
# Ajustar somente parâmetros públicos em terraform.tfvars.
terraform init
terraform fmt
terraform validate
terraform plan -out=sivale.tfplan
```

Revisar o plano e os custos. O plan consulta a AWS, mas não cria recursos.
Somente em etapa posterior autorizada, o operador poderá executar
`terraform apply sivale.tfplan`. Nenhum apply foi executado nesta implementação.
Versionar `.terraform.lock.hcl` após `init`, para fixar as versões usadas.

O estado é local nesta etapa. Mesmo sem segredos da aplicação, contém metadados e
deve ser protegido e mantido fora do Git, assim como planos. Para colaboração,
configurar backend remoto criptografado com controle de acesso e locking antes de
compartilhar a operação. Nunca passar runtime.env ou certificados para Terraform.

## Build e distribuição

Na raiz do projeto, em máquina/CI com Docker ativo:

```powershell
docker build --platform linux/amd64 -f backend/Dockerfile.ec2 -t ghcr.io/SUA-ORGANIZACAO/sivale-backend:VERSAO backend
docker push ghcr.io/SUA-ORGANIZACAO/sivale-backend:VERSAO
```

Escolher registry acessível à EC2. Usar digest imutável (`imagem@sha256:...`) em
`BACKEND_IMAGE` e preferir digest também em `CADDY_IMAGE`. Para registry privado,
autenticar por canal seguro com `--password-stdin`/credential helper, fora do
Terraform. A role atual não permite ECR privado: isso exige política adicional
limitada ao repositório. Não colocar tokens em argumentos, histórico ou comandos
SSM Run Command. Alternativamente, usar um registry público aprovado para a imagem.

`Dockerfile.ec2.dockerignore` usa allowlist: exclui `.env`, certificados, client
gerado localmente, testes e Python. Não usar segredos como build args. A geração
Prisma e o build não recebem credenciais Aiven. A imagem final executa como usuário
`node`, sem ferramentas de compilação, e não contém migrations nem scripts de seed.

## Preparação da instância e HTTPS

Após provisionamento autorizado, obter `instance_id`, `public_ip` e o comando SSM
com `terraform output`. Entrar via Session Manager e aguardar o bootstrap:

```sh
sudo cloud-init status --wait
sudo systemctl status docker amazon-ssm-agent
```

Se o bootstrap falhar, verificar `/var/log/cloud-init-output.log` antes de continuar.
O bootstrap instala Docker e units, mas não inicia aplicações sem configuração.

1. Criar registro DNS **A** do domínio da API para o Elastic IP. Remover AAAA
   incompatível: este módulo não provisiona IPv6.
2. Criar `/etc/sivale/deploy.env` com o formato de `deploy/deploy.env.example`.
   Informar imagem backend, imagem Caddy, domínio (hostname sem esquema/caminho)
   e e-mail ACME. Somente configuração pública nesse arquivo; sem expansão de variáveis.
3. Fornecer `/etc/sivale/runtime.env` por canal protegido ou editor na sessão,
   seguindo `deploy/runtime.env.example`. Não copiar valores de `.env` do projeto,
   não usar `echo` com segredos nem deixá-los no histórico. Se houver gravação de
   terminal/sessão que capture entradas, usar mecanismo aprovado de entrega de
   segredos antes de continuar, evitando que a gravação capture os valores.
4. Obter a CA pública Aiven por canal confiável e instalar `/etc/sivale/ca.pem`.
   O container monta somente leitura e usa `NODE_EXTRA_CA_CERTS`. Usar hostname/porta
   do Aiven e `sslmode=verify-full` em `DATABASE_URL`. Não desabilitar validação TLS.
   Remover da URL referências a caminhos de certificados da máquina local, se houver.
5. Configurar a origem HTTPS Vercel em `CORS_ORIGINS` e preencher explicitamente
   todas as chaves de integração. Confirmar se o Aiven aceita conexão do Elastic IP;
   nenhuma configuração do banco é alterada nesta etapa.

Aplicar permissões e baixar imagens, na sessão Linux:

```sh
sudo chown root:root /etc/sivale/runtime.env /etc/sivale/deploy.env /etc/sivale/ca.pem
sudo chmod 600 /etc/sivale/runtime.env /etc/sivale/deploy.env
sudo chmod 644 /etc/sivale/ca.pem
sudo -i
# Apenas configuração pública: nunca carregar runtime.env no shell.
set -a
. /etc/sivale/deploy.env
set +a
docker pull "$BACKEND_IMAGE"
docker pull "$CADDY_IMAGE"
systemctl enable --now sivale-backend.service sivale-proxy.service
exit
```

`/etc/sivale` é root-only. A CA é pública e deve ser legível pelo usuário não root
do container. Os segredos permanecem no disco criptografado e no ambiente Docker;
root e usuários com acesso a Docker podem lê-los. Não conceder grupo Docker sem necessidade.
Nenhum segredo é input/output, user_data ou recurso Terraform.

Caddy emite/renova certificado com domínio válido, DNS correto e acesso público
80/443. HTTP redireciona para HTTPS. Sem domínio e validação ACME, HTTPS público
não está concluído. Não apontar Vercel HTTPS para API HTTP. Restrições de
`web_ingress_cidrs` precisam ser compatíveis com clientes e validação ACME.
Certificados Caddy persistem em volumes Docker: não removê-los durante deploy.

## Verificação, atualização e retorno

```sh
sudo systemctl status sivale-backend sivale-proxy
sudo docker ps
sudo docker inspect --format '{{.State.Health.Status}}' sivale-backend
curl --fail https://api.seu-dominio.example/
```

Validar login, leituras autorizadas, conexão TLS Aiven, preflight/CORS da origem
Vercel e integração ThingSpeak antes da migração de tráfego. Não escrever no banco
apenas para testar disponibilidade. Não imprimir `docker inspect` completo nem
arquivos runtime: podem conter segredos. Revisar logs com o mesmo cuidado.

Atualizar: publicar/puxar nova imagem, ajustar `BACKEND_IMAGE` e executar
`sudo systemctl restart sivale-backend`. Isso também recarrega runtime.env.
Atualizações do Caddy exigem pull/restart do proxy. Guardar digest anterior para
rollback. Render permanece disponível até validação da migração.

Atualizações de AMI pública ou user_data podem substituir a EC2 no próximo plan.
Revisar essas mudanças: segredos, configuração local e volumes Caddy não são
restaurados automaticamente e não sobrevivem à destruição da instância.
Planejar recuperação segura antes de substituir a EC2.

## Validação desta etapa

Manifest e lockfile consistentes; npm run build passou com NODE_OPTIONS=--max-old-space-size=4096.
Docker sem daemon disponível, inclusive fora do sandbox: build/execução Linux ainda
não confirmados. O workflow prepara smoke test isolado, sem acessar Aiven.
Não foi publicado ou implantado nada nesta etapa, nem executada migration.
As limitações e verificações operacionais estão em [DEPLOY_BACKEND.md](DEPLOY_BACKEND.md).

## Referências

- [IAM mínimo de Session Manager](https://docs.aws.amazon.com/systems-manager/latest/userguide/getting-started-create-iam-instance-profile.html)
- [HTTPS automático Caddy](https://caddyserver.com/docs/automatic-https)
- [TLS node-postgres](https://node-postgres.com/features/ssl)
- [Parâmetros TLS da URL PostgreSQL](https://github.com/brianc/node-postgres/blob/master/packages/pg-connection-string/README.md)
