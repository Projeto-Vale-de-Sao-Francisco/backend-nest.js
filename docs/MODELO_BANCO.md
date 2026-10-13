# SIVALE — Modelo do banco de dados (ER)

Fonte da verdade: [`api/prisma/schema.prisma`](../api/prisma/schema.prisma) e as migrations em `api/prisma/migrations`.
Para exportar PNG/SVG, cole o bloco abaixo em https://mermaid.live.

```mermaid
erDiagram
    empresa ||--o{ usuarioEmpresa : "tem"
    usuario ||--o{ usuarioEmpresa : "vinculado a"
    empresa ||--o{ propriedade : "é responsável por"
    usuario ||--o{ usuarioPropriedade : "acessa"
    propriedade ||--o{ usuarioPropriedade : "é acessada por"
    propriedade ||--o{ talhao : "possui"
    propriedade ||--o{ operacaoLogistica : "origina"
    cultura ||--o{ talhao : "é cultivada em"
    cultura ||--o{ valorMercado : "tem valores"
    talhao ||--o{ dispositivo : "é monitorado por"
    talhao ||--o{ alerta : "recebe"
    talhao |o--o{ operacaoLogistica : "origem do lote"
    dispositivo ||--o{ sensor : "possui"
    dispositivo ||--o{ medicao : "gera"
    dispositivo |o--o{ alerta : "origina"
    medicao |o--o{ alerta : "dispara"

    empresa {
        int id PK
        string razaoSocial
        string nomeFantasia
        string cpfCnpj UK
        string telefone
        string email
        string cidade
        string estado
        string responsavel
        string status
    }
    usuario {
        int id PK
        string nomeCompleto
        string cpf UK
        string email UK
        string telefone
        string senha "hash bcrypt"
        Perfil perfil "ADMINISTRADOR|GESTOR|TECNICO|AGRICULTOR"
        string status
    }
    usuarioEmpresa {
        int id PK
        int usuarioId FK
        int empresaId FK
        string status
        datetime dataAssociacao
    }
    propriedade {
        int id PK
        int empresaId FK
        string nome
        string localizacao
        string municipio
        string estado
        float latitude
        float longitude
        float areaTotal "hectares"
        string status
    }
    usuarioPropriedade {
        int id PK
        int usuarioId FK
        int propriedadeId FK
        string status
        datetime dataAssociacao
    }
    cultura {
        int id PK
        string nome
        string variedade
        float temperaturaMin
        float temperaturaMax
        float umidadeMin "umidade do ar"
        float umidadeMax "umidade do ar"
        int cicloMedioDias
        string descricao
    }
    talhao {
        int id PK
        int propriedadeId FK
        int culturaId FK
        string nome
        string descricao
        float latitude
        float longitude
        float area "hectares"
        date dataPlantio
        date previsaoColheita
        string status
    }
    dispositivo {
        int id PK
        int talhaoId FK
        string codigo UK
        string nome
        string chaveApiHash UK "SHA-256 da chave"
        string tipo
        float latitude
        float longitude
        string status
        datetime dataInstalacao
    }
    sensor {
        int id PK
        int dispositivoId FK
        string tipo
        string unidadeMedida
        string status
    }
    medicao {
        int id PK
        int dispositivoId FK
        datetime dataHora
        float temperatura
        float umidade
        float umidadeSolo
        float luminosidade
        float precipitacao
    }
    alerta {
        int id PK
        int talhaoId FK
        int dispositivoId FK
        int medicaoId FK
        string tipo "CLIMATICO|FALHA_SENSOR"
        NivelAlerta nivel "ATENCAO|CRITICO"
        string titulo
        string descricao
        datetime dataHora
        boolean visualizado
        boolean resolvido
        datetime resolvidoEm
    }
    valorMercado {
        int id PK
        int culturaId FK
        string mercadoDestino
        float precoMedio
        string moeda
        date dataReferencia
        string demandaEstimada
        OrigemValor origem "MANUAL|ATUALIZACAO"
    }
    operacaoLogistica {
        int id PK
        int propriedadeId FK
        int talhaoId FK
        string origem
        string destino
        string modal
        date dataPrevista
        string tempoEstimado
        float custoEstimado
        string transportadora
        string situacao
    }
```

## Decisões de modelagem

- **Usuário ↔ Propriedade é N:N** por `usuarioPropriedade` e **Usuário ↔ Empresa é N:N** por `usuarioEmpresa`; o papel vem de `usuario.perfil` (`ADMINISTRADOR`, `GESTOR`, `TECNICO`, `AGRICULTOR`). No MVP, TÉCNICO e AGRICULTOR têm as mesmas permissões (V2: menor privilégio). O Gestor enxerga as propriedades das empresas vinculadas; os demais, só as propriedades vinculadas. Ver [PERFIS_E_TELAS](PERFIS_E_TELAS.md).
- **Empresa** é o produtor, a cooperativa ou a exportadora. Liga-se a usuários (`usuarioEmpresa`) e propriedades (`propriedade.empresaId`, opcional).
- **Talhão** é a área física dentro da propriedade; a cultura é um atributo dele. Latitude e longitude existem em Propriedade, Talhão e Dispositivo.
- **Dispositivo** (ESP32) pertence a um talhão e tem vários **sensores** (temperatura, umidade). A chave de API do dispositivo é guardada só como hash.
- **Medição** é uma coleta conjunta de temperatura e umidade por dispositivo; solo, luminosidade e precipitação são opcionais.
- **Alerta** nasce de uma medição fora da faixa da cultura (`CLIMATICO`) ou de um dispositivo sem comunicação (`FALHA_SENSOR`). `visualizado` indica que alguém viu; `resolvido` indica que foi tratado. A tabela `Alerta` serve de base para análises futuras (variação, histórico, risco, comparação, indicadores).
- **valorMercado** guarda uma linha por cultura, destino e data de referência (permite histórico). `origem` separa cadastro manual de atualização pelo botão do site; não há job agendado.
- **operacaoLogistica** guarda origem, destino, modal, prazo, custo, transportadora e situação, opcionalmente ligada a um talhão.

## Ajustes pendentes para a 2ª entrega (do planejamento dos dashboards)

| Ajuste | Dashboard |
|---|---|
| Entidade `Colheita` (quantidade prevista e colhida, unidade padronizada) | T3, P3 |
| Faixa de umidade do **solo** na cultura (hoje `umidadeMin/Max` valem para o ar) | T1 |
| Conversão de câmbio para comparar destinos em reais | P4 |
| Recomendações de colheita e exportação (saída do modelo Python) | T3, P4 |
| Estoque e embalagem para calcular volume disponível para venda | P3 (futuro) |
