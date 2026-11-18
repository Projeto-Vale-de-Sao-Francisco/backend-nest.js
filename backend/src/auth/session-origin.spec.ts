import { describe, expect, it, vi } from 'vitest';
import type { Request } from 'express';
import { hasAllowedSessionOrigin } from '../common/session-origin.js';

function request(
  method: string,
  path: string,
  origin?: string,
  cookie?: string,
) {
  return {
    method,
    path,
    headers: { cookie },
    get: vi.fn().mockReturnValue(origin),
  } as unknown as Request;
}

describe('session origin protection', () => {
  const allowedOrigins = new Set(['https://sivale.example']);

  it('requires an allowed Origin for login and cookie mutations', () => {
    expect(
      hasAllowedSessionOrigin(
        request('POST', '/auth/login', 'https://attacker.example'),
        allowedOrigins,
      ),
    ).toBe(false);
    expect(
      hasAllowedSessionOrigin(
        request('PATCH', '/users/1', undefined, 'sivale_session=jwt'),
        allowedOrigins,
      ),
    ).toBe(false);
  });

  it('allows same-origin mutations and requests without cookie authentication', () => {
    expect(
      hasAllowedSessionOrigin(
        request('POST', '/auth/login', 'https://sivale.example'),
        allowedOrigins,
      ),
    ).toBe(true);
    expect(
      hasAllowedSessionOrigin(
        request('POST', '/readings'),
        allowedOrigins,
      ),
    ).toBe(true);
    expect(
      hasAllowedSessionOrigin(
        request('GET', '/auth/me', undefined, 'sivale_session=jwt'),
        allowedOrigins,
      ),
    ).toBe(true);
  });
});
