export class CreateDeviceDto {
  /**
   * Código único do dispositivo/sensor para identificação e integridade dos dados.
   */
  codigo: string;

  /**
   * Nome/modelo do hardware. Ex.: "ESP32-DHT22" ou "SEN-TH-01".
   */
  modelo: string;

  /**
   * Status do dispositivo no sistema. Padrão: "ativo".
   */
  status?: string;

  /**
   * Identificador do talhão/lote ao qual o dispositivo está vinculado.
   */
  talhaoId: number;

  /**
   * Identificador opcional da propriedade para validação de consistência.
   */
  propriedadeId?: number;

  /**
   * Tipo do sensor associado. Ex: "temperatura_umidade", "umidade_solo".
   * Padrão: "temperatura_umidade".
   */
  tipoSensor?: string;

  /**
   * Unidade de medida do sensor. Ex: "°C, %", "%", "lux".
   * Padrão: "°C, %".
   */
  unidadeMedida?: string;

  /**
   * Data de instalação do dispositivo. Quando não informada, usa a data atual.
   */
  dataInstalacao?: string | Date;
}
