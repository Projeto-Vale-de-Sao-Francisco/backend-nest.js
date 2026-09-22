<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>
<h1 align="center">ValeVivo Backend</h1>

<p align="center">
  Tecnologia e Inteligência para a Agricultura do Vale do São Francisco 🍇🥭🌵
</p>
<p align="center">
  <img src="https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/NestJS-E0234E?style=for-the-badge&logo=nestjs&logoColor=white" alt="NestJS" />
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Prisma-2D3748?style=for-the-badge&logo=prisma&logoColor=white" alt="Prisma" />
  <img src="https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL" />
</p>
<p align="center">
  <img src="https://img.shields.io/badge/status-em%20desenvolvimento-yellow?style=flat-square" alt="Status" />
  <img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="License" />
</p>
---

## Sobre o projeto

O **ValeVivo Backend** é a API responsável por receber, processar e armazenar os dados de sensores do sistema **ValeVivo**, além de integrar com a plataforma **ThingSpeak** para leitura e escrita de telemetria. Construído com **NestJS** e **Prisma**, oferece uma base sólida, tipada e escalável para o restante da aplicação.

## 📑 Sumário

- [🌱 Sobre o projeto](#-sobre-o-projeto)
- [🛠️ Tecnologias utilizadas](#️-tecnologias-utilizadas)
- [📋 Pré-requisitos](#-pré-requisitos)
- [⚙️ Instalação](#️-instalação)
- [🔐 Configuração das variáveis de ambiente](#-configuração-das-variáveis-de-ambiente)
- [🚀 Executando o projeto](#-executando-o-projeto)
- [📡 Endpoints](#-endpoints)
- [📁 Estrutura do projeto](#-estrutura-do-projeto)

## Tecnologias

| Camada         | Tecnologia |
| -------------- | ---------- |
| Runtime        | Node.js    |
| Framework      | NestJS     |
| Linguagem      | TypeScript |
| ORM            | Prisma     |
| Banco de dados | PostgreSQL |
| HTTP Client    | Axios      |
| Integração IoT | ThingSpeak |

## Pré-requisitos

Antes de começar, tenha instalado em sua máquina:

* **Node.js**
* **npm**
* **Git**

> Também é necessário ter acesso ao banco de dados **PostgreSQL** utilizado pelo projeto.

## Instalação

**1.** Clone o repositório:

```bash
git clone https://github.com/Projeto-Vale-de-Sao-Francisco/SIVALE-backend-node.js.git
```

**2.** Entre na pasta do backend:

```bash
cd SIVALE-backend-node.js/backend
```

**3.** Instale as dependências:

```bash
npm install
```

## Variáveis de ambiente

Crie um arquivo `.env` dentro da pasta `backend/` seguindo o modelo abaixo:

```env
DATABASE_URL="sua_url_de_conexao_postgresql"
 
THINGSPEAK_CHANNEL_ID="seu_channel_id"
THINGSPEAK_WRITE_API_KEY="sua_write_api_key"
THINGSPEAK_READ_API_KEY="sua_read_api_key"
```

> **Atenção**
>
> * Se a conexão com o PostgreSQL utilizar certificado SSL, coloque o arquivo `ca.pem` na raiz da pasta `backend/`.
> * Os arquivos `.env` e `ca.pem` **nunca** devem ser enviados para o repositório.

## Prisma

Gerar o Prisma Client:

```bash
npx prisma generate
```

Atualizar o schema do Prisma a partir do banco de dados:

```bash
npx prisma db pull
```

## Banco de dados

Para popular o banco com dados iniciais de desenvolvimento:

```bash
npx prisma db seed
```

## Executando o projeto

```bash
npm run start:dev
```

Por padrão, o servidor sobe em:

```text
http://localhost:3000
```

## Scripts disponíveis

| Comando               | Descrição                                       |
| --------------------- | ----------------------------------------------- |
| `npm run start`       | Executa o projeto                               |
| `npm run start:dev`   | Executa em modo de desenvolvimento (watch mode) |
| `npm run start:prod`  | Executa em modo de produção                     |
| `npx prisma generate` | Gera o Prisma Client                            |
| `npx prisma db pull`  | Atualiza o schema a partir do banco             |
| `npx prisma db seed`  | Popula o banco com dados iniciais               |
| `npm test`            | Executa os testes                               |
| `npm run build`       | Compila e valida o projeto                      |

## Estrutura do projeto

```text
backend/
├── prisma/
│   ├── schema.prisma      # Schema do banco de dados
│   └── seed.ts            # Script de seed
├── src/
│   ├── prisma/            # Módulo de conexão com o Prisma
│   ├── thingspeak/        # Integração com a API ThingSpeak
│   ├── app.module.ts      # Módulo raiz da aplicação
│   └── main.ts            # Ponto de entrada
├── .env                    # Variáveis de ambiente (não versionado)
├── ca.pem                  # Certificado SSL (não versionado)
├── package.json
├── prisma.config.ts
└── tsconfig.json
```

## Fluxo rápido de desenvolvimento

Após configurar o `.env`, siga esta sequência para colocar o projeto no ar:

```bash
npm install
npx prisma generate
npx prisma db seed
npm run start:dev
```

O backend estará disponível em:

```text
http://localhost:3000
```

---

<p align="center">
  Desenvolvido para o <strong>Projeto Vale São Francisco</strong>
</p>

