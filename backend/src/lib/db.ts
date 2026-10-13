import { DatabaseSync } from "node:sqlite";
import path from "node:path";

const DB_PATH = process.env.DB_PATH || path.join(__dirname, "..", "..", "sivale.db");
export const db = new DatabaseSync(DB_PATH);
db.exec("PRAGMA foreign_keys = ON;");

// Schema - equivalente ao modelo relacional do projeto (ver docs/MODELO_BANCO.md)
db.exec(`
CREATE TABLE IF NOT EXISTS empresas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  razao_social TEXT NOT NULL,
  nome_fantasia TEXT,
  cpf_cnpj TEXT UNIQUE NOT NULL,
  telefone TEXT,
  email TEXT,
  cidade TEXT,
  estado TEXT,
  status INTEGER NOT NULL DEFAULT 1,
  criado_em TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  cpf TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  senha_hash TEXT NOT NULL,
  telefone TEXT,
  perfil TEXT NOT NULL DEFAULT 'PRODUTOR',
  status INTEGER NOT NULL DEFAULT 1,
  empresa_id INTEGER REFERENCES empresas(id),
  criado_em TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS propriedades (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  empresa_id INTEGER NOT NULL REFERENCES empresas(id),
  nome TEXT NOT NULL,
  municipio TEXT NOT NULL,
  estado TEXT NOT NULL,
  latitude REAL,
  longitude REAL,
  area_total REAL,
  status INTEGER NOT NULL DEFAULT 1,
  criado_em TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS culturas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  variedade TEXT,
  temperatura_min REAL NOT NULL,
  temperatura_max REAL NOT NULL,
  umidade_min REAL NOT NULL,
  umidade_max REAL NOT NULL,
  ciclo_medio_dias INTEGER,
  descricao TEXT,
  criado_em TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS lotes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  propriedade_id INTEGER NOT NULL REFERENCES propriedades(id),
  cultura_id INTEGER NOT NULL REFERENCES culturas(id),
  nome TEXT NOT NULL,
  area REAL,
  data_plantio TEXT,
  previsao_colheita TEXT,
  status TEXT NOT NULL DEFAULT 'ativo',
  criado_em TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sensores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lote_id INTEGER NOT NULL REFERENCES lotes(id),
  codigo TEXT UNIQUE NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'temperatura_umidade',
  latitude REAL,
  longitude REAL,
  data_instalacao TEXT NOT NULL DEFAULT (datetime('now')),
  status TEXT NOT NULL DEFAULT 'ativo'
);

CREATE TABLE IF NOT EXISTS leituras_sensor (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sensor_id INTEGER NOT NULL REFERENCES sensores(id),
  data_hora TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  temperatura REAL NOT NULL,
  umidade REAL NOT NULL,
  umidade_solo REAL,
  luminosidade REAL,
  precipitacao REAL
);
CREATE INDEX IF NOT EXISTS idx_leituras_sensor ON leituras_sensor(sensor_id, data_hora);

CREATE TABLE IF NOT EXISTS dados_mercado (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cultura_id INTEGER NOT NULL REFERENCES culturas(id),
  mercado_destino TEXT NOT NULL,
  preco_medio REAL NOT NULL,
  moeda TEXT NOT NULL DEFAULT 'BRL',
  data_referencia TEXT NOT NULL DEFAULT (datetime('now')),
  demanda_estimada TEXT
);

CREATE TABLE IF NOT EXISTS operacoes_logisticas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  empresa_id INTEGER NOT NULL REFERENCES empresas(id),
  lote_id INTEGER REFERENCES lotes(id),
  origem TEXT NOT NULL,
  destino TEXT NOT NULL,
  modal TEXT NOT NULL,
  data_prevista TEXT,
  tempo_estimado TEXT,
  custo_estimado REAL,
  transportadora TEXT,
  situacao TEXT NOT NULL DEFAULT 'planejada',
  criado_em TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS alertas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lote_id INTEGER NOT NULL REFERENCES lotes(id),
  sensor_id INTEGER REFERENCES sensores(id),
  tipo TEXT NOT NULL,
  nivel TEXT NOT NULL DEFAULT 'atencao',
  titulo TEXT NOT NULL,
  descricao TEXT NOT NULL,
  data_hora TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  visualizado INTEGER NOT NULL DEFAULT 0
);
`);

// ---- Mapeadores linha (snake_case) -> objeto de resposta (camelCase) ----
export const mapEmpresa = (r: any) => r && ({
  id: r.id, razaoSocial: r.razao_social, nomeFantasia: r.nome_fantasia, cpfCnpj: r.cpf_cnpj,
  telefone: r.telefone, email: r.email, cidade: r.cidade, estado: r.estado,
  status: !!r.status, criadoEm: r.criado_em,
});

export const mapUsuario = (r: any) => r && ({
  id: r.id, nome: r.nome, cpf: r.cpf, email: r.email, telefone: r.telefone,
  perfil: r.perfil, status: !!r.status, empresaId: r.empresa_id, criadoEm: r.criado_em,
});

export const mapPropriedade = (r: any) => r && ({
  id: r.id, empresaId: r.empresa_id, nome: r.nome, municipio: r.municipio, estado: r.estado,
  latitude: r.latitude, longitude: r.longitude, areaTotal: r.area_total,
  status: !!r.status, criadoEm: r.criado_em,
});

export const mapCultura = (r: any) => r && ({
  id: r.id, nome: r.nome, variedade: r.variedade,
  temperaturaMin: r.temperatura_min, temperaturaMax: r.temperatura_max,
  umidadeMin: r.umidade_min, umidadeMax: r.umidade_max,
  cicloMedioDias: r.ciclo_medio_dias, descricao: r.descricao, criadoEm: r.criado_em,
});

export const mapLote = (r: any) => r && ({
  id: r.id, propriedadeId: r.propriedade_id, culturaId: r.cultura_id, nome: r.nome,
  area: r.area, dataPlantio: r.data_plantio, previsaoColheita: r.previsao_colheita,
  status: r.status, criadoEm: r.criado_em,
});

export const mapSensor = (r: any) => r && ({
  id: r.id, loteId: r.lote_id, codigo: r.codigo, tipo: r.tipo,
  latitude: r.latitude, longitude: r.longitude,
  dataInstalacao: r.data_instalacao, status: r.status,
});

export const mapLeitura = (r: any) => r && ({
  id: r.id, sensorId: r.sensor_id, dataHora: r.data_hora,
  temperatura: r.temperatura, umidade: r.umidade,
  umidadeSolo: r.umidade_solo, luminosidade: r.luminosidade, precipitacao: r.precipitacao,
});

export const mapDadoMercado = (r: any) => r && ({
  id: r.id, culturaId: r.cultura_id, mercadoDestino: r.mercado_destino,
  precoMedio: r.preco_medio, moeda: r.moeda, dataReferencia: r.data_referencia,
  demandaEstimada: r.demanda_estimada,
});

export const mapLogistica = (r: any) => r && ({
  id: r.id, empresaId: r.empresa_id, loteId: r.lote_id, origem: r.origem, destino: r.destino,
  modal: r.modal, dataPrevista: r.data_prevista, tempoEstimado: r.tempo_estimado,
  custoEstimado: r.custo_estimado, transportadora: r.transportadora, situacao: r.situacao,
  criadoEm: r.criado_em,
});

export const mapAlerta = (r: any) => r && ({
  id: r.id, loteId: r.lote_id, sensorId: r.sensor_id, tipo: r.tipo, nivel: r.nivel,
  titulo: r.titulo, descricao: r.descricao, dataHora: r.data_hora, visualizado: !!r.visualizado,
});
