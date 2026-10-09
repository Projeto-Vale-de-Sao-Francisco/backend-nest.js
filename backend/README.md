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
