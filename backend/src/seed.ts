import "dotenv/config";
import bcrypt from "bcryptjs";
import { db } from "./lib/db";

async function main() {
  console.log("Populando banco SIVALE com dados de exemplo...");

  const jaExiste = db.prepare(`SELECT id FROM empresas LIMIT 1`).get();
  if (jaExiste) {
    console.log("Banco já contém dados. Nada a fazer (apague sivale.db para recomeçar).");
    return;
  }

  const empresaId = db
    .prepare(`INSERT INTO empresas (razao_social, nome_fantasia, cpf_cnpj, telefone, email, cidade, estado) VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run("Vale Verde Exportação de Frutas Ltda", "Vale Verde", "12345678000199", "(87) 99999-0001", "contato@valeverde.com.br", "Petrolina", "PE")
    .lastInsertRowid;

  const senhaHash = await bcrypt.hash("123456", 10);
  db.prepare(`INSERT INTO usuarios (nome, cpf, email, senha_hash, perfil, empresa_id) VALUES (?, ?, ?, ?, ?, ?)`)
    .run("Administrador SIVALE", "00000000000", "admin@sivale.com.br", senhaHash, "ADMINISTRADOR", empresaId);
  db.prepare(`INSERT INTO usuarios (nome, cpf, email, senha_hash, perfil, empresa_id) VALUES (?, ?, ?, ?, ?, ?)`)
    .run("Carlos Produtor", "11111111111", "carlos@sivale.com.br", senhaHash, "PRODUTOR", empresaId);

  const mangaId = db
    .prepare(`INSERT INTO culturas (nome, variedade, temperatura_min, temperatura_max, umidade_min, umidade_max, ciclo_medio_dias, descricao) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .run("Manga", "Tommy Atkins", 20, 34, 40, 70, 150, "Muito sensível ao manejo da água e ao clima.")
    .lastInsertRowid;
  const uvaId = db
    .prepare(`INSERT INTO culturas (nome, variedade, temperatura_min, temperatura_max, umidade_min, umidade_max, ciclo_medio_dias, descricao) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .run("Uva", "Thompson Seedless", 15, 32, 35, 65, 120, "Sensível a mudanças de clima e doenças fúngicas.")
    .lastInsertRowid;

  const fazenda1Id = db
    .prepare(`INSERT INTO propriedades (empresa_id, nome, municipio, estado, latitude, longitude, area_total) VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run(empresaId, "Fazenda Vale Verde", "Petrolina", "PE", -9.3891, -40.5029, 120)
    .lastInsertRowid;
  const fazenda2Id = db
    .prepare(`INSERT INTO propriedades (empresa_id, nome, municipio, estado, latitude, longitude, area_total) VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run(empresaId, "Estância das Águas", "Juazeiro", "BA", -9.4106, -40.4986, 85)
    .lastInsertRowid;

  const lote1Id = db
    .prepare(`INSERT INTO lotes (propriedade_id, cultura_id, nome, area, data_plantio, previsao_colheita) VALUES (?, ?, ?, ?, ?, ?)`)
    .run(fazenda1Id, mangaId, "Lote 42", 12, "2024-02-01", "2026-11-20")
    .lastInsertRowid;
  const lote2Id = db
    .prepare(`INSERT INTO lotes (propriedade_id, cultura_id, nome, area, data_plantio, previsao_colheita) VALUES (?, ?, ?, ?, ?, ?)`)
    .run(fazenda2Id, uvaId, "Setor Sul", 8, "2024-05-10", "2026-10-12")
    .lastInsertRowid;

  const sensor1Id = db
    .prepare(`INSERT INTO sensores (lote_id, codigo, tipo, latitude, longitude) VALUES (?, ?, ?, ?, ?)`)
    .run(lote1Id, "ESP32-01", "temperatura_umidade", -9.389, -40.503)
    .lastInsertRowid;
  const sensor2Id = db
    .prepare(`INSERT INTO sensores (lote_id, codigo, tipo, latitude, longitude) VALUES (?, ?, ?, ?, ?)`)
    .run(lote2Id, "ESP32-02", "temperatura_umidade", -9.4108, -40.4989)
    .lastInsertRowid;

  const insertLeitura = db.prepare(
    `INSERT INTO leituras_sensor (sensor_id, data_hora, temperatura, umidade) VALUES (?, ?, ?, ?)`
  );

  // Historico simulado das ultimas 48h (leituras a cada 2h)
  const agora = Date.now();
  for (let i = 48; i >= 0; i -= 2) {
    const dataHora = new Date(agora - i * 60 * 60 * 1000).toISOString();
    insertLeitura.run(
      sensor1Id,
      dataHora,
      Number((26 + Math.sin(i / 4) * 6 + Math.random() * 2).toFixed(1)),
      Number((50 + Math.cos(i / 5) * 10 + Math.random() * 3).toFixed(1))
    );
    insertLeitura.run(
      sensor2Id,
      dataHora,
      Number((24 + Math.sin(i / 3) * 5 + Math.random() * 2).toFixed(1)),
      Number((48 + Math.cos(i / 4) * 8 + Math.random() * 3).toFixed(1))
    );
  }

  db.prepare(`INSERT INTO dados_mercado (cultura_id, mercado_destino, preco_medio, moeda, demanda_estimada) VALUES (?, ?, ?, ?, ?)`)
    .run(mangaId, "União Europeia", 4.85, "USD", "alta");
  db.prepare(`INSERT INTO dados_mercado (cultura_id, mercado_destino, preco_medio, moeda, demanda_estimada) VALUES (?, ?, ?, ?, ?)`)
    .run(uvaId, "Estados Unidos", 4.10, "USD", "média");

  db.prepare(`INSERT INTO alertas (lote_id, sensor_id, tipo, nivel, titulo, descricao) VALUES (?, ?, 'climatico', 'critico', 'Alerta crítico', ?)`)
    .run(lote1Id, sensor1Id, "Sensor ESP32-01 registrou temperatura muito acima do limite seguro.");

  console.log("Seed concluído com sucesso.");
  console.log("Login de teste -> email: admin@sivale.com.br | senha: 123456");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
