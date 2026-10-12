import {
  IsInt,
  Min,
  Max,
  IsISO8601,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateDeviceDto {
  /**
   * Código único do dispositivo/sensor para identificação e integridade dos dados.
   */
  @IsString({ message: 'codigo deve ser uma string' })
  codigo: string;

  /**
   * Nome/modelo do hardware. Ex.: "ESP32-DHT22" ou "SEN-TH-01".
   */
  @IsString({ message: 'modelo deve ser uma string' })
  modelo: string;

  /**
   * Status do dispositivo no sistema. Padrão: "ativo".
   */
  @IsOptional()
  @IsString()
  status?: string;

  /**
   * Identificador do talhão/lote ao qual o dispositivo está vinculado.
   */
  @IsInt()
  @Min(1)
  @Max(2147483647)
  talhaoId: number;

  /**
   * Identificador opcional da propriedade para validação de consistência.
   */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(2147483647)
  propriedadeId?: number;

  /**
   * Tipo do sensor associado. Ex: "temperatura_umidade", "umidade_solo".
   * Padrão: "temperatura_umidade".
   */
  @IsOptional()
  @IsString()
  tipoSensor?: string;

  /**
   * Unidade de medida do sensor. Ex: "°C, %", "%", "lux".
   * Padrão: "°C, %".
   */
  @IsOptional()
  @IsString()
  unidadeMedida?: string;

  /**
   * Data de instalação do dispositivo. Quando não informada, usa a data atual.
   */
  @IsOptional()
  @IsISO8601({ strict: true })
  dataInstalacao?: string;
}
