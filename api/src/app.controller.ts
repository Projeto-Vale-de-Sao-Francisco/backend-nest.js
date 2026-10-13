import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from './common/decorators.js';

@ApiTags('saude')
@Controller()
export class AppController {
  @Public()
  @Get()
  status() {
    return { servico: 'SIVALE API', status: 'online', versao: '2.0.0' };
  }
}
