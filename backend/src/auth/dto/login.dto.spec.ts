import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { LoginDto } from './login.dto.js';

describe('LoginDto', () => {
  it('rejects passwords longer than the bcrypt input limit', async () => {
    const dto = plainToInstance(LoginDto, {
      email: 'user@example.com',
      senha: 'a'.repeat(73),
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'senha')).toBe(true);
  });

  it('counts UTF-8 bytes for multibyte passwords', async () => {
    const dto = plainToInstance(LoginDto, {
      email: 'user@example.com',
      senha: '🙂'.repeat(19),
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'senha')).toBe(true);
  });
});
