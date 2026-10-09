export class UpdateDeviceStatusDto {
  /**
   * Novo status do dispositivo. Ex.: "ativo" ou "inativo".
   */
  status: 'ativo' | 'inativo';
}
