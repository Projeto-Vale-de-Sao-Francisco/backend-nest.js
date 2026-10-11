# SIVALE — ValeVivo Backend (NestJS)

API de backend do projeto **ValeVivo**, responsável pela telemetria IoT, gestão de sensores agrícolas, detecção de anomalias climáticas e suporte às operações do agronegócio no Vale do São Francisco.

Para a documentação completa de arquitetura, regras de negócio e guia dos próximos épicos, consulte:
👉 **[DOCUMENTACAO_TECNICA.md](../DOCUMENTACAO_TECNICA.md)**

---

## 🚀 Como Iniciar Rapidamente

1. **Configurar variáveis de ambiente (`.env`):**
   ```env
   DATABASE_URL="postgresql://postgres:1234@localhost:5432/postgres?schema=public"
   DEVICE_API_KEY="iot-simulator-secret-2026"
   JWT_SECRET="gere-uma-chave-longa-e-aleatoria"
   JWT_EXPIRES_IN="1h"
   SEED_ADMIN_NOME="Administrador"
   SEED_ADMIN_EMAIL="admin@example.com"
   SEED_ADMIN_SENHA="SenhaAdmin123"
   SEED_ADMIN_CPF="52998224725"
   PORT=3000
   ```

2. **Sincronizar banco e popular dados iniciais:**
   ```bash
   npx prisma db push
   npx prisma db seed
   ```

3. **Executar a API em modo de desenvolvimento:**
   ```bash
   npm run start:dev
   ```

4. **Executar o simulador de sensores IoT (em outro terminal):**
   ```bash
   npm run simulator
   ```

---

## 🧪 Qualidade de Código e Testes

```bash
npm run lint      # Checagem de linter com Oxlint
npm run format    # Formatação com Prettier
npm test          # Suíte de testes unitários com Vitest
npm run build     # Compilação TypeScript de produção
```

## Usuários e autenticação

Copie `.env.example` para `.env` e defina valores seguros. Para o administrador
inicial, `SEED_ADMIN_NOME`, `SEED_ADMIN_EMAIL`, `SEED_ADMIN_SENHA` e
`SEED_ADMIN_CPF` são obrigatórios. `SEED_ADMIN_TELEFONE` e
`SEED_ADMIN_VINCULO` são opcionais; sem eles, o seed usa respectivamente
`0000000000` e `Administração`.

Após aplicar as migrations, execute:

```bash
npx prisma db seed
```
