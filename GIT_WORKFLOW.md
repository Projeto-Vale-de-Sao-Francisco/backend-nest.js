# Fluxo Git do backend SIVALE

Repositorio oficial: `Projeto-Vale-de-Sao-Francisco/backend-nest.js`.

- `main`: versao estavel usada pelo Render em producao.
- `feat/backend-mvp`: desenvolvimento e revisao, incluindo infraestrutura.
- Integracao em `main` somente por Pull Request revisado. Nao fazer push direto
  em `main`, force push ou criar branches permanentes adicionais.

Antes de trabalhar, executar `git fetch origin --prune` e verificar o estado
local. Preservar alteracoes locais antes de sincronizar. Atualizar primeiro com
`git merge --ff-only origin/feat/backend-mvp`; depois incorporar `origin/main`
por fast-forward quando possivel ou merge revisado, preservando historico.
Nao substituir arquivos de negocio por copias antigas para resolver conflitos.

Commits devem separar seguranca, testes, Docker/CI e infraestrutura. Adicionar
arquivos por caminho explicito e revisar `git diff --cached` antes do commit.
Enviar apenas com `git push origin HEAD:refs/heads/feat/backend-mvp`.

## Validacao

O workflow `backend-ec2-image.yml` executa em push na branch de desenvolvimento,
Pull Request para `main` e disparo manual. Faz `npm ci`, geracao Prisma, testes
unitarios e de contrato, build NestJS, build Docker Linux AMD64 e smoke test.
Usa PostgreSQL descartavel e credenciais ficticias. Nao executa migrations,
Terraform, deploy ou publicacao GHCR. O banco vazio valida conexao e bootstrap;
nao comprova operacoes sobre tabelas nem compatibilidade com o banco de producao.

Terraform: executar somente `terraform fmt -check -recursive` e
`terraform validate` para esta revisao. `validate` nao verifica drift nem garante
que um futuro plan sera seguro. Preservar state e backups fora do Git.

## Antes do merge

- Exigir Actions verde no commit final e revisar as alteracoes de seguranca.
- Confirmar por canal seguro as variaveis de runtime do Render e clientes IoT;
  coordenar rotacao das credenciais anteriormente presentes no historico.
- Revisar migrations separadamente antes de qualquer deploy autorizado.
- Revisar futuro plan Terraform: AMI dinamica e mudancas de user data podem
  provocar substituicao da EC2. Nao aplicar infraestrutura para publicar codigo.

Arquivos `.env`, estados, tfvars reais, planos, certificados e backups nao devem
ser commitados. Exemplos sem segredos e `.terraform.lock.hcl` sao versionados.
Protecoes de branch e checks obrigatorios devem ser confirmados pelo mantenedor
nas configuracoes do GitHub; este documento nao configura essas protecoes.
