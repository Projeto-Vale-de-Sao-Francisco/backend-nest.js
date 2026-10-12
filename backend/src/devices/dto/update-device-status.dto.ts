import { IsIn, IsString } from 'class-validator';

export class UpdateDeviceStatusDto {
  /**
   * Novo status do dispositivo. Ex.: "ativo" ou "inativo".
   */
  @IsString({ message: 'status deve ser uma string' })
  @IsIn(['ativo', 'inativo'], {
    message: 'status deve ser "ativo" ou "inativo"',
  })
  status: 'ativo' | 'inativo';
}
