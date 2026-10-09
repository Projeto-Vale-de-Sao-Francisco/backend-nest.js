# E5. Sensores IoT simulados

*Requisitos 7 · Cadastro e gestão dos dispositivos*

| ID | História | Prioridade | 
| ----- | ----- | ----- | 
| **5.1** | Cadastrar sensor (código, tipo, propriedade, lote, latitude, longitude, data de instalação, status) | **Alta** | 
| **5.2** | Listar e filtrar sensores por propriedade, lote e status | **Média** | 
| **5.3** | Ativar/inativar sensor | **Média** | 

# E6. Leituras e ingestão de dados

*Requisitos 8, 9 · Simulador, endpoints de registro e consulta*

| ID | História | Prioridade | 
| ----- | ----- | ----- | 
| **6.1** | Endpoint para registrar leitura (sensor, data/hora, temperatura, umidade) | **Alta** | 
| **6.2** | Validar a leitura (sensor existe e está ativo, valores plausíveis) e devolver erro claro | **Alta** | 
| **6.3** | Endpoint para coação | **Alta** | 
| **6.4** | Simulador que gera leituras periódicas e envia pra API | **Alta** | 
| **6.5** | Endpoint para consultar sensores com a última leitura | **Média** | 
| **6.6** | Autenticar o simulador na API (chave ou token de dispositivo) | **Média** | 
| **6.7** | Campos extras (pressão, luminosidade, precipitação, umidade do solo) | **Baixa** | 

# E9. Alertas climáticos

*Requisitos 14 · Aviso quando a leitura sai da faixa da cultura*

| ID | História | Prioridade | 
| ----- | ----- | ----- | 
| **9.1** | Gerar alerta ao receber leitura fora da faixa da cultura do lote | **Alta** | 
| **9.2** | Listar alertas com mensagem legível (ex: "Temperatura acima do recomendado para o lote de uvas.") | **Alta** | 
| **9.3** | Destacar alertas ativos no dashboard | **Média** | 
| **9.4** | Marcar alerta como visto/resolvido | **Média** | 
| **9.5** | Evitar alertas repetidos em sequência pro mesmo sensor | **Média** | 
