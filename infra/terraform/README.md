# Infraestrutura SIVALE

Fonte oficial: `Projeto-Vale-de-Sao-Francisco/backend-nest.js`.
`main` e producao Render; `feat/backend-mvp` concentra desenvolvimento e revisao.
Consulte [o fluxo Git](../../GIT_WORKFLOW.md).

- [AWS existente e preservacao do state](aws/README.md)
- [Build e operacao do backend](aws/DEPLOY_BACKEND.md)

A infraestrutura AWS ja foi integrada pelo commit `c81497a` e PR #5.
Nao reaplicar copias antigas da consolidacao sobre essa versao. State, tfvars,
backups e certificados permanecem fora do Git. Validacao local usa somente
`terraform fmt -check -recursive` e `terraform validate`, sem consultar AWS.
