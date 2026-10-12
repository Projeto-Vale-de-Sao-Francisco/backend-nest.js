import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { PrincipalGuard } from './principal.guard.js';

describe('PrincipalGuard', () => {
  const createContext = (user?: { id: number }) =>
    ({
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    }) as ExecutionContext;

  it.each([undefined, { id: 0 }, { id: Number.NaN }])(
    'rejects a missing or malformed principal',
    async (user) => {
      const authz = { assertActiveUser: vi.fn() };
      const guard = new PrincipalGuard(authz as never);

      await expect(
        guard.canActivate(createContext(user)),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(authz.assertActiveUser).not.toHaveBeenCalled();
    },
  );

  it('checks that the authenticated principal is active', async () => {
    const authz = { assertActiveUser: vi.fn().mockResolvedValue(undefined) };
    const guard = new PrincipalGuard(authz as never);

    await expect(guard.canActivate(createContext({ id: 19 }))).resolves.toBe(
      true,
    );
    expect(authz.assertActiveUser).toHaveBeenCalledWith(19);
  });
});
