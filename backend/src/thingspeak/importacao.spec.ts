import { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ThingspeakService } from './thingspeak.service.js';

describe('Importação ThingSpeak', () => {
  const sensor = {
    tipo: 'temperatura_umidade',
    status: 'ativo',
    dispositivo: { status: 'ativo' },
  };
  let db: any;
  let alerts: any;
  let service: ThingspeakService;
  beforeEach(() => {
    db = {
      sensor: { findUnique: vi.fn().mockResolvedValue(sensor) },
      medicao: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: 9 }),
      },
      $queryRaw: vi.fn().mockResolvedValue([]),
      $transaction: vi.fn(),
    };
    db.$transaction.mockImplementation((callback: (tx: unknown) => unknown) =>
      callback(db),
    );
    alerts = { checkAndCreateAlerts: vi.fn().mockResolvedValue([]) };
    service = new ThingspeakService(
      db,
      new ConfigService({ THINGSPEAK_SENSOR_ID: '1' }),
      alerts,
    );
    vi.spyOn(service, 'buscarDados').mockResolvedValue({
      feeds: [
        { field1: '28.5', field2: '62', created_at: '2026-01-01T00:00:00Z' },
      ],
    });
  });
  it('importa em transação e aciona alertas', async () => {
    expect(await service.salvarUltimaMedicao()).toMatchObject({
      importada: true,
    });
    expect(db.$queryRaw).toHaveBeenCalledTimes(1);
    expect(db.medicao.create).toHaveBeenCalledWith({
      data: {
        sensor_id: 1,
        temperatura: 28.5,
        umidade: 62,
        data_hora: new Date('2026-01-01T00:00:00Z'),
      },
    });
    expect(alerts.checkAndCreateAlerts).toHaveBeenCalledWith(9, 1);
  });
  it('repetição não grava nem duplica alertas', async () => {
    db.medicao.findFirst.mockResolvedValue({ id: 9 });
    expect(await service.salvarUltimaMedicao()).toMatchObject({
      importada: false,
    });
    expect(db.medicao.create).not.toHaveBeenCalled();
    expect(alerts.checkAndCreateAlerts).not.toHaveBeenCalled();
  });
  it.each([
    null,
    { ...sensor, status: 'inativo' },
    { ...sensor, tipo: 'umidade_solo' },
    { ...sensor, dispositivo: { status: 'inativo' } },
  ])('rejeita sensor inadequado: %j', async (value) => {
    db.sensor.findUnique.mockResolvedValue(value);
    await expect(service.salvarUltimaMedicao()).rejects.toThrow();
    expect(vi.spyOn(service, 'buscarDados')).not.toHaveBeenCalled();
  });
  it.each([
    { field1: null },
    { field2: '101' },
    { field1: 'NaN' },
    { field1: '' },
    { created_at: 'inválida' },
  ])('rejeita feed inválido: %j', async (value) => {
      vi.spyOn(service, 'buscarDados').mockResolvedValue({
      feeds: [
        {
          field1: '25',
          field2: '60',
          created_at: '2026-01-01T00:00:00Z',
          ...value,
        },
      ],
    });
    await expect(service.salvarUltimaMedicao()).rejects.toThrow();
    expect(db.$transaction).not.toHaveBeenCalled();
  });
  it('exige configuração explícita', async () => {
    service = new ThingspeakService(
      db,
      new ConfigService({ THINGSPEAK_SENSOR_ID: '' }),
      alerts,
    );
    await expect(service.salvarUltimaMedicao()).rejects.toThrow(
      'THINGSPEAK_SENSOR_ID',
    );
  });
});
