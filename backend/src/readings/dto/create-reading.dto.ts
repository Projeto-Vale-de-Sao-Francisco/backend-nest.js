import {
  IsInt,
  Min,
  Max,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateReadingDto {
  /**
   * ID direto do sensor (opcional se fornecido codigoDispositivo).
   */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(2147483647)
  sensorId?: number;

  /**
   * Código de identificação do dispositivo (ex: "SEN-TH-01" ou "ESP32-01").
   * Facilita a integração direta de placas IoT/simulador.
   */
  @IsOptional()
  @IsString({ message: 'codigoDispositivo deve ser uma string' })
  codigoDispositivo?: string;

  /**
   * Data e hora da coleta da leitura. Padrão: data/hora atual.
   */
  @IsOptional()
  @IsISO8601({ strict: true })
  dataHora?: string;

  /**
   * Temperatura em graus Celsius (°C).
   */
  @IsNumber({}, { message: 'temperatura deve ser um número' })
  @Min(-50)
  @Max(65)
  temperatura: number;

  /**
   * Umidade relativa do ar em percentual (%).
   */
  @IsNumber({}, { message: 'umidade deve ser um número' })
  @Min(0)
  @Max(100)
  umidade: number;

  /**
   * Umidade do solo em percentual (%) - Requisito 6.7.
   */
  @IsOptional()
  @IsNumber({}, { message: 'umidadeSolo deve ser um número' })
  @Min(0)
  @Max(100)
  umidadeSolo?: number;

  /**
   * Luminosidade em lux - Requisito 6.7.
   */
  @IsOptional()
  @IsNumber({}, { message: 'luminosidade deve ser um número' })
  @Min(0)
  luminosidade?: number;

  /**
   * Precipitação de chuva em milímetros (mm) - Requisito 6.7.
   */
  @IsOptional()
  @IsNumber({}, { message: 'precipitacao deve ser um número' })
  @Min(0)
  precipitacao?: number;

  /**
   * Pressão atmosférica em hPa - Requisito 6.7.
   */
  @IsOptional()
  @IsNumber({}, { message: 'pressao deve ser um número' })
  @Min(0)
  pressao?: number;
}
