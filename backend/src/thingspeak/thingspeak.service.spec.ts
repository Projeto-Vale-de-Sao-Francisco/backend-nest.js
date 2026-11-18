import { Test, TestingModule } from '@nestjs/testing';
import { ThingspeakService } from './thingspeak.service.js';
import { ServiceUnavailableException } from '@nestjs/common';

describe('ThingspeakService', () => {
  let service: ThingspeakService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ThingspeakService,
        {
          provide: 'PrismaService',
          useValue: {},
        },
      ],
    })
      .useMocker(() => ({}))
      .compile();

    service = module.get<ThingspeakService>(ThingspeakService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('não usa credenciais ou chaves demonstrativas embutidas', async () => {
    delete process.env.THINGSPEAK_CHANNEL_ID;
    delete process.env.THINGSPEAK_WRITE_API_KEY;
    delete process.env.THINGSPEAK_READ_API_KEY;

    await expect(service.buscarDados()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
