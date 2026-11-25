import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ThingspeakService } from './thingspeak.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { AlertsService } from '../alerts/alerts.service.js';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

const service = () => new ThingspeakService(
  {} as PrismaService,
  new ConfigService(),
  {} as AlertsService,
);

describe('ThingSpeak runtime credentials', () => {
  it.each(['read', 'write'])('does not call ThingSpeak when the %s key is absent', async (operation) => {
    const config = new ConfigService();
    vi.spyOn(config, 'getOrThrow').mockImplementation(() => { throw new Error('Missing runtime key'); });
    const subject = new ThingspeakService({} as PrismaService, config, {} as AlertsService);
    const http = vi.spyOn(axios, 'get');
    await expect(operation === 'read' ? subject.buscarDados() : subject.enviarDados(25, 60))
      .rejects.toThrow('Missing runtime key');
    expect(http).not.toHaveBeenCalled();
  });

  it('uses the configured read and write keys', async () => {
    vi.stubEnv('THINGSPEAK_READ_API_KEY', 'test-only-read');
    vi.stubEnv('THINGSPEAK_WRITE_API_KEY', 'test-only-write');
    const http = vi.spyOn(axios, 'get').mockResolvedValue({ data: {} });
    await service().buscarDados();
    expect(http.mock.calls[0][1]?.params.api_key).toBe('test-only-read');
    await service().enviarDados(25, 60);
    expect(http.mock.calls[1][1]?.params.api_key).toBe('test-only-write');
  });
});
