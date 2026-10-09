export class CreateReadingDto {
  /**
   * ID direto do sensor (opcional se fornecido codigoDispositivo).
   */
  sensorId?: number;

  /**
   * Código de identificação do dispositivo (ex: "SEN-TH-01" ou "ESP32-01").
   * Facilita a integração direta de placas IoT/simulador.
   */
  codigoDispositivo?: string;

  /**
   * Data e hora da coleta da leitura. Padrão: data/hora atual.
   */
  dataHora?: string | Date;

  /**
   * Temperatura em graus Celsius (°C).
   */
  temperatura: number;

  /**
   * Umidade relativa do ar em percentual (%).
   */
  umidade: number;

  /**
   * Umidade do solo em percentual (%) - Requisito 6.7.
   */
  umidadeSolo?: number;

  /**
   * Luminosidade em lux - Requisito 6.7.
   */
  luminosidade?: number;

  /**
   * Precipitação de chuva em milímetros (mm) - Requisito 6.7.
   */
  precipitacao?: number;

  /**
   * Pressão atmosférica em hPa - Requisito 6.7.
   */
  pressao?: number;
}
