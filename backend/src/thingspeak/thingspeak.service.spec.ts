import { Test, TestingModule } from '@nestjs/testing';
import { ThingspeakService } from './thingspeak.service.js';

describe('ThingspeakService', () => {
  let service: ThingspeakService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ThingspeakService],
    }).compile();

    service = module.get<ThingspeakService>(ThingspeakService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
