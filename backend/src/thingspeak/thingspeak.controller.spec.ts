import { Test, TestingModule } from '@nestjs/testing';
import { ThingspeakController } from './thingspeak.controller.js';

describe('ThingspeakController', () => {
  let controller: ThingspeakController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ThingspeakController],
    }).compile();

    controller = module.get<ThingspeakController>(ThingspeakController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
