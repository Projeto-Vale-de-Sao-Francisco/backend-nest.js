import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import {
  SESSION_COOKIE_NAME,
  sessionCookieOptions,
} from './session-cookie.js';

describe('AuthController session cookie', () => {
  const authService = {
    login: vi.fn(),
    logout: vi.fn(),
  };
  const response = {
    cookie: vi.fn(),
    clearCookie: vi.fn(),
  };
  let controller: AuthController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new AuthController(authService as unknown as AuthService);
  });

  it('sets an HttpOnly cookie and omits the JWT from the login response', async () => {
    authService.login.mockResolvedValue({
      accessToken: 'signed-jwt',
      user: { id: 1, nome: 'Test', email: 'test@example.com', tipo: 'ADMIN' },
    });

    await expect(
      controller.login(
        { email: 'test@example.com', senha: 'Senha123' },
        { ip: '192.0.2.10' } as Request,
        response as Response,
      ),
    ).resolves.toEqual({
      user: { id: 1, nome: 'Test', email: 'test@example.com', tipo: 'ADMIN' },
    });
    expect(response.cookie).toHaveBeenCalledWith(
      SESSION_COOKIE_NAME,
      'signed-jwt',
      expect.objectContaining({
        httpOnly: true,
        sameSite: 'strict',
        path: '/',
      }),
    );
  });

  it('invalidates server sessions and clears the browser cookie on logout', async () => {
    await controller.logout(
      { id: 1, nome: 'Test', email: 'test@example.com', tipo: 'ADMIN' },
      response as Response,
    );

    expect(authService.logout).toHaveBeenCalledWith(1);
    expect(response.clearCookie).toHaveBeenCalledWith(
      SESSION_COOKIE_NAME,
      sessionCookieOptions(),
    );
  });
});
