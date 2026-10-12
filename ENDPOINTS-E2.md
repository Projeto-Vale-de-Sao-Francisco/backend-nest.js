# Endpoints do E2: Usuários e autenticação

API do backend (NestJS + Prisma + PostgreSQL). Base local: `http://localhost:3000` (ou a porta definida em `PORT`).

Rotas marcadas com 🔒 precisam do header:

```
Authorization: Bearer <access_token>
```

O token vem do login. Rotas marcadas com 🛡️ exigem também que o usuário seja **ADMIN**.

## Resumo

| Método | Rota | Acesso | O que faz |
|--------|------|--------|-----------|
| POST | `/auth/login` | Público | Login com e-mail e senha, devolve o token |
| GET | `/auth/me` | 🔒 | Dados do usuário logado |
| POST | `/auth/logout` | 🔒 | Invalida os tokens emitidos até agora |
| POST | `/users` | Público | Cadastro comum (sempre `COMUM` e `ATIVO`) |
| POST | `/users/admin` | 🔒🛡️ | Cadastro definindo `tipo` e `status` |
| GET | `/users` | 🔒🛡️ | Lista paginada com filtros |
| GET | `/users/:id` | 🔒🛡️ | Busca usuário por id |
| PATCH | `/users/:id` | 🔒🛡️ | Edita usuário |
| PATCH | `/users/:id/status` | 🔒🛡️ | Ativa ou inativa usuário |

---

## Autenticação

### POST `/auth/login`

Público. Não precisa de token.

**Body**

```json
{
  "email": "admin@vsf.com",
  "senha": "SenhaAdmin123"
}
```

**Resposta 200**

```json
{
  "access_token": "eyJhbGciOi...",
  "expires_in": 3600,
  "usuario": {
    "id": 1,
    "nome": "Admin VSF",
    "email": "admin@vsf.com",
    "tipo": "ADMIN",
    "vinculo": "...",
    "status": "ATIVO"
  }
}
```

**Erros**
- `401`: e-mail ou senha inválidos (a mensagem é genérica de propósito) ou usuário inativo.
- `400`: body inválido.

O payload do JWT leva `sub` (id), `tipo` e `tokenVersion`. A expiração vem de `JWT_EXPIRES_IN` no `.env`.

### GET `/auth/me` 🔒

Sem body. Devolve o usuário do token, sem senha.

**Resposta 200**

```json
{
  "id": 1,
  "nome": "Admin VSF",
  "cpf": "52998224725",
  "email": "admin@vsf.com",
  "telefone": "87999999999",
  "tipo": "ADMIN",
  "vinculo": "...",
  "status": "ATIVO"
}
```

**Erros**
- `401`: sem token, token inválido, expirado, usuário inativo ou token invalidado por logout.

### POST `/auth/logout` 🔒

Sem body. Incrementa o `tokenVersion` do usuário, então **todos** os tokens emitidos antes deixam de valer. Para voltar a usar a API, é só fazer login de novo.

---

## Usuários

### POST `/users`

Público. Cadastro comum.

**Body**

```json
{
  "nome": "Maria Souza",
  "cpf": "11144477735",
  "email": "maria@vsf.com",
  "telefone": "87999999999",
  "senha": "Senha1234",
  "vinculo": "Produtora"
}
```

Se vier `tipo` ou `status` no body, **são ignorados**: o usuário é sempre criado como `COMUM` e `ATIVO`.

**Resposta 201**: o usuário criado, sem senha e sem `tokenVersion`.

**Erros**
- `400`: validação (campo faltando, CPF inválido, senha fraca etc.).
- `409`: CPF ou e-mail já cadastrado (a mensagem diz qual campo).

### POST `/users/admin` 🔒🛡️

Igual ao cadastro comum, mas aceita `tipo` e `status`.

**Body**

```json
{
  "nome": "João Silva",
  "cpf": "39053344705",
  "email": "joao@vsf.com",
  "telefone": "87988888888",
  "senha": "Senha1234",
  "vinculo": "Gestão",
  "tipo": "ADMIN",
  "status": "ATIVO"
}
```

**Resposta 201**: o usuário criado.

**Erros**: `400`, `401`, `403` (não é admin), `409`.

### GET `/users` 🔒🛡️

Lista paginada.

**Query params (todos opcionais)**

| Param | Descrição |
|-------|-----------|
| `page` | Página (padrão `1`) |
| `limit` | Itens por página (padrão `20`, máximo `100`) |
| `nome` | Filtra por nome |
| `email` | Filtra por e-mail |
| `cpf` | Filtra por CPF |
| `tipo` | `ADMIN` ou `COMUM` |
| `status` | `ATIVO` ou `INATIVO` |

**Exemplo**

```
GET /users?status=ATIVO&tipo=COMUM&page=1&limit=10
```

**Resposta 200**

```json
{
  "data": [ { "id": 2, "nome": "Maria Souza", "...": "..." } ],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 1,
    "totalPages": 1
  }
}
```

### GET `/users/:id` 🔒🛡️

Devolve o usuário. `404` se o id não existir.

### PATCH `/users/:id` 🔒🛡️

Edita só o que for enviado. Todos os campos são opcionais.

```json
{
  "nome": "Maria da Silva Souza",
  "telefone": "87977777777"
}
```

Campos aceitos: `nome`, `cpf`, `email`, `telefone`, `vinculo`, `tipo`, `senha`.

- Se mandar `senha`, ela é re-hasheada e os tokens anteriores do usuário são invalidados.
- Valem as mesmas validações do cadastro e o `409` para CPF/e-mail duplicado.
- `404` se o id não existir.

### PATCH `/users/:id/status` 🔒🛡️

```json
{
  "status": "INATIVO"
}
```

Valores aceitos: `ATIVO` ou `INATIVO` (em maiúsculas).

Regras:
- Ao inativar, os tokens do usuário são invalidados e ele não consegue mais logar.
- Um admin **não pode inativar a si mesmo nem rebaixar o próprio tipo**.
- Nunca pode ficar sem pelo menos um ADMIN ativo.

---

## Validações de cadastro

| Campo | Regra |
|-------|-------|
| `nome` | Obrigatório, mínimo 3 caracteres |
| `cpf` | CPF válido (dígitos verificadores). Aceita com ou sem pontuação, é salvo só com dígitos |
| `email` | E-mail válido. Salvo em minúsculas |
| `telefone` | 10 ou 11 dígitos. Salvo só com dígitos |
| `senha` | Mínimo 8 caracteres, com pelo menos 1 letra e 1 número. Salva com bcrypt |
| `vinculo` | Texto livre |

O `ValidationPipe` global usa `whitelist` e `forbidNonWhitelisted`: campos que não existem no DTO retornam `400`.

## Códigos de erro

| Código | Quando |
|--------|--------|
| 400 | Body ou query inválidos, regra de negócio violada |
| 401 | Sem token, token inválido ou expirado, credenciais erradas, usuário inativo |
| 403 | Usuário logado sem permissão (não é ADMIN) |
| 404 | Usuário não encontrado |
| 409 | CPF ou e-mail já cadastrado |

## Variáveis de ambiente

```
DATABASE_URL=
JWT_SECRET=
JWT_EXPIRES_IN=1h
SEED_ADMIN_NOME=
SEED_ADMIN_EMAIL=
SEED_ADMIN_SENHA=
SEED_ADMIN_CPF=
```

A API não sobe sem `JWT_SECRET`. O admin inicial é criado com `npx prisma db seed` (pode rodar mais de uma vez, não duplica).

## Observação

As rotas dos outros módulos (`devices`, `readings`, `alerts`, `simulator`, `thingspeak`) continuam abertas, sem guard de autenticação.
