# Integração do frontend com o backend NestJS do SiVale

**Data:** 12/10/2026  
**Status:** desenho aprovado  
**Escopo:** consolidar o frontend React e o backend NestJS em uma aplicação funcional, eliminando implementações redundantes somente após validação.

## 1. Contexto

O projeto `sivale` contém atualmente três componentes relevantes:

- `frontend/`: aplicação React/Vite com as telas operacionais do SiVale;
- `api/`: API NestJS já alinhada a grande parte do contrato consumido pelo frontend;
- `backend/`: implementação Express/SQLite anterior e redundante.

Há também um backend NestJS externo em `C:\Users\tiago\Downloads\backend-nest.js-main (1)\backend-nest.js-main\backend`, com regras e testes mais completos em áreas como autenticação, usuários, dispositivos, leituras, alertas, mercado, logística e dashboard.

O frontend já possui uma superfície funcional ampla. Portanto, a integração não deve descartar telas válidas nem trocar todo o contrato HTTP por rotas incompatíveis.

## 2. Decisão arquitetural

O diretório `sivale/api` será o único backend oficial da aplicação.

O backend NestJS baixado será usado como fonte de regras, testes e implementações que serão incorporadas ao `sivale/api`. Ele não será mantido como uma segunda API executável dentro do produto.

O contrato público em português já consumido pelo frontend será preservado. As rotas em inglês encontradas no backend baixado serão adaptadas durante a incorporação.

O backend Express em `sivale/backend` somente poderá ser removido depois que os testes de contrato, builds e fluxos integrados confirmarem que nenhuma funcionalidade necessária depende dele.

## 3. Alternativas consideradas

### 3.1 Substituição integral pelo backend baixado

Foi descartada porque exigiria alterar grande parte do frontend, perderia módulos já existentes de empresas e propriedades e introduziria um modelo de dados incompatível com várias telas atuais.

### 3.2 Manutenção da API atual sem consolidação

Foi descartada porque desperdiçaria regras e testes mais completos do backend baixado e manteria implementações duplicadas.

### 3.3 Consolidação incremental no `sivale/api`

Foi escolhida por preservar o contrato existente, permitir migração testável por domínio e produzir uma única fonte de verdade para API e banco de dados.

## 4. Arquitetura final

```text
frontend React/Vite
        |
        | HTTP/JSON + JWT
        v
api NestJS
        |
        | Prisma
        v
PostgreSQL
```

Estrutura pretendida:

```text
sivale/
├── frontend/     # cliente oficial
├── api/          # backend oficial
├── docs/         # documentação consolidada
└── backend/      # removido apenas após a validação da migração
```

## 5. Contrato HTTP

O frontend continuará consumindo os seguintes recursos:

| Domínio | Rotas públicas do produto |
| --- | --- |
| Autenticação | `/auth/login`, `/auth/me`, `/auth/logout` |
| Usuários | `/usuarios` e vínculos com empresas/propriedades |
| Empresas | `/empresas` |
| Propriedades | `/propriedades` |
| Culturas | `/culturas` |
| Talhões | `/talhoes` |
| Dispositivos | `/dispositivos` |
| Sensores | `/sensores` |
| Medições | `/medicoes` e `/ingest/medicoes` |
| Alertas | `/alertas`, `/alertas/:id/visualizar`, `/alertas/:id/resolver` |
| Mercado | `/mercado` e `/mercado/atualizar` |
| Logística | `/logistica` |
| Dashboard | `/dashboard/resumo`, `/dashboard/historico` e análises por talhão/propriedade |

As rotas `/users`, `/devices`, `/readings`, `/alerts` e `/lotes` do backend baixado não substituirão diretamente o contrato. Sua lógica deverá ser incorporada aos módulos equivalentes em português.

As respostas devem manter formatos estáveis e tipados. Mudanças inevitáveis serão feitas simultaneamente no cliente de API e nos testes de contrato.

## 6. Modelo de domínio

O schema do `sivale/api` será a base porque representa diretamente o fluxo atual:

```text
Empresa
└── Propriedade
    └── Talhão
        ├── Cultura
        ├── Dispositivo
        │   ├── Sensor
        │   └── Medição
        ├── Alerta
        └── Operação logística
```

Também serão mantidos os vínculos de usuário com empresa e propriedade.

Do schema baixado poderão ser incorporados, quando necessários ao escopo atual:

- versão de token para revogação de sessões;
- permissões explícitas;
- auditoria de operações;
- campos adicionais de medição;
- regras mais completas de mercado e logística.

Entidades de recomendação de colheita, recomendação de exportação e colheita não serão expostas no frontend nesta integração, pois ainda não possuem um fluxo completo aprovado. O schema não deve ser ampliado com essas entidades apenas para conservar código sem uso.

## 7. Autenticação e autorização

O login continuará retornando um token JWT consumido pelo frontend. O endpoint `/auth/me` será a fonte de identidade e perfil da sessão.

Perfis preservados:

- `ADMINISTRADOR`: acesso e gestão global;
- `GESTOR`: acesso às empresas e respectivas propriedades vinculadas;
- `TECNICO`: acesso operacional às propriedades vinculadas;
- `AGRICULTOR`: acompanhamento das propriedades autorizadas.

O frontend poderá ocultar ações incompatíveis com o perfil para melhorar a experiência, mas toda autorização será revalidada no backend.

A consolidação deve incorporar expiração e revogação de sessão, hash de senha, validação de credenciais e filtros de acesso por vínculo.

## 8. Frontend

Serão preservadas as telas:

- login;
- painel principal e painéis analíticos;
- histórico climático;
- alertas;
- empresas e usuários;
- propriedades, talhões e culturas;
- dispositivos;
- mercado;
- logística;
- perfil.

Cada tela mantida deverá ter endpoint funcional e tratamento para:

- carregamento;
- resultado vazio;
- erro de validação;
- falha de rede;
- acesso negado;
- sessão expirada;
- sucesso ou falha de operações mutáveis.

Componentes, botões ou rotas sem regra de negócio e sem endpoint serão removidos ou ocultados. A remoção dependerá de busca de referências para evitar quebrar navegação, imports ou fluxos válidos.

A URL da API será configurável por variável de ambiente, com valor local documentado para desenvolvimento.

## 9. Ingestão, dispositivos e alertas

As leituras devem aceitar somente dispositivos ativos e autenticados. Valores inválidos ou implausíveis devem produzir erros claros.

O fluxo esperado é:

```text
simulador/dispositivo
  -> autenticação do dispositivo
  -> ingestão da medição
  -> persistência
  -> avaliação da faixa da cultura
  -> criação controlada de alerta
  -> atualização do dashboard
```

Alertas repetidos para a mesma condição e dispositivo não devem ser criados continuamente enquanto a condição anterior permanecer ativa.

## 10. Mercado e logística

As telas de mercado e logística serão mantidas porque já fazem parte do escopo funcional.

A integração deve preservar:

- listagem e filtros;
- cadastro e edição conforme permissão;
- atualização de valores de mercado;
- identificação da origem dos valores;
- operações logísticas vinculadas a propriedades e, quando aplicável, talhões.

Integrações externas devem ter timeout, tratamento de falha e resposta previsível. Uma falha externa não poderá apagar dados já armazenados.

## 11. Tratamento de erros e observabilidade

A API utilizará o mecanismo global de validação do NestJS e um formato consistente para erros HTTP.

Erros esperados devem distinguir, pelo menos:

- `400`: dados inválidos;
- `401`: sessão ausente, inválida ou expirada;
- `403`: perfil ou vínculo insuficiente;
- `404`: recurso inexistente ou fora do escopo do usuário;
- `409`: duplicidade ou conflito de estado;
- `500/502/503`: falha interna ou dependência externa indisponível.

Dados sensíveis, senhas, hashes, chaves de dispositivo e tokens não poderão aparecer em respostas ou logs.

## 12. Estratégia de testes

A implementação seguirá testes antes das mudanças de comportamento.

Camadas previstas:

1. testes unitários das regras incorporadas do backend baixado;
2. testes de contrato para cada endpoint utilizado em `frontend/src/api.ts`;
3. testes de autorização por perfil e vínculo;
4. testes de integração do Prisma com PostgreSQL de teste;
5. build e verificação estática do frontend;
6. build, lint e testes do backend;
7. fluxo ponta a ponta: login, consulta, cadastro permitido, ingestão, alerta e dashboard.

Não será considerado suficiente validar somente que os dois projetos compilam. A integração deverá demonstrar que o navegador envia uma requisição válida, a API aplica a regra, o banco persiste/consulta os dados e o frontend apresenta o resultado.

## 13. Sequência de migração

1. Congelar e testar o contrato atualmente consumido pelo frontend.
2. Consolidar schema, migrações e seed Prisma.
3. Integrar autenticação, usuários, vínculos e permissões.
4. Integrar empresas, propriedades, culturas e talhões.
5. Integrar dispositivos, sensores, ingestão e medições.
6. Integrar alertas e dashboard.
7. Integrar mercado e logística.
8. Ajustar o frontend apenas onde o contrato final exigir.
9. Executar a verificação completa e atualizar documentação de execução.
10. Remover o backend Express antigo e demais componentes comprovadamente redundantes.

## 14. Critérios de aceitação

A integração será aceita quando:

- existir apenas uma API oficial no fluxo documentado;
- todas as telas mantidas consumirem endpoints reais;
- login, sessão e permissões funcionarem de ponta a ponta;
- usuários somente enxergarem empresas e propriedades autorizadas;
- dispositivos enviarem medições autenticadas;
- medições atualizarem histórico, alertas e dashboard;
- mercado e logística funcionarem sem dados simulados ocultos;
- testes e builds do frontend e backend passarem;
- a aplicação puder ser iniciada localmente por instruções reproduzíveis;
- nenhum componente removido possuir referência ativa ou dependência funcional.

## 15. Fora do escopo imediato

- implantação em produção;
- modelo preditivo real de colheita ou exportação;
- infraestrutura AWS definitiva;
- hardware IoT físico;
- novos módulos não representados nas telas ou nos requisitos fornecidos.

Esses itens poderão ser preparados arquiteturalmente, mas não serão apresentados como implementados nesta integração.
