import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Public, Usuario, type UsuarioLogado } from '../common/decorators.js';
import { LoginDto } from './auth.dto.js';
import { AuthService } from './auth.service.js';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @HttpCode(200)
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @ApiBearerAuth()
  @Get('me')
  me(@Usuario() usuario: UsuarioLogado) {
    return this.auth.perfil(usuario.id);
  }

  @ApiBearerAuth()
  @HttpCode(204)
  @Post('logout')
  async logout(@Usuario() usuario: UsuarioLogado) {
    await this.auth.logout(usuario.id);
  }
}
