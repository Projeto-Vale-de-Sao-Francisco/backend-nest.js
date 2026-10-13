import "dotenv/config";
import express from "express";
import cors from "cors";

import authRoutes from "./routes/auth.routes";
import usuariosRoutes from "./routes/usuarios.routes";
import empresasRoutes from "./routes/empresas.routes";
import propriedadesRoutes from "./routes/propriedades.routes";
import culturasRoutes from "./routes/culturas.routes";
import lotesRoutes from "./routes/lotes.routes";
import sensoresRoutes from "./routes/sensores.routes";
import leiturasRoutes from "./routes/leituras.routes";
import mercadoRoutes from "./routes/mercado.routes";
import logisticaRoutes from "./routes/logistica.routes";
import dashboardRoutes from "./routes/dashboard.routes";
import alertasRoutes from "./routes/alertas.routes";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (_req, res) => {
  res.json({ servico: "SIVALE API", status: "online", versao: "1.0.0" });
});

app.use("/auth", authRoutes);
app.use("/usuarios", usuariosRoutes);
app.use("/empresas", empresasRoutes);
app.use("/propriedades", propriedadesRoutes);
app.use("/culturas", culturasRoutes);
app.use("/lotes", lotesRoutes);
app.use("/sensores", sensoresRoutes);
app.use("/leituras", leiturasRoutes);
app.use("/mercado", mercadoRoutes);
app.use("/logistica", logisticaRoutes);
app.use("/dashboard", dashboardRoutes);
app.use("/alertas", alertasRoutes);

const PORT = process.env.PORT || 3333;
app.listen(PORT, () => {
  console.log(`SIVALE API rodando em http://localhost:${PORT}`);
});
