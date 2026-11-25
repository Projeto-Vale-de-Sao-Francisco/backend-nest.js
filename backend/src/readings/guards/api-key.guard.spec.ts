import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiKeyGuard } from './api-key.guard.js';

const context = (key?: string) => ({
  switchToHttp: () => ({ getRequest: () => ({ headers: { 'x-api-key': key } }) }),
}) as unknown as ExecutionContext;

afterEach(() => vi.unstubAllEnvs());

describe('ApiKeyGuard runtime configuration', () => {
  it('rejects requests when no device credential is configured', () => {
    vi.stubEnv('DEVICE_API_KEY', '');
    const guard = new ApiKeyGuard(new ConfigService());
    expect(() => guard.canActivate(context('test-only-key'))).toThrow(UnauthorizedException);
    expect(() => guard.canActivate(context())).toThrow(UnauthorizedException);
  });

  it('accepts the configured key and rejects a different key', () => {
    vi.stubEnv('DEVICE_API_KEY', 'test-only-key');
    const guard = new ApiKeyGuard(new ConfigService());
    expect(guard.canActivate(context('test-only-key'))).toBe(true);
    expect(() => guard.canActivate(context('different-test-key'))).toThrow(UnauthorizedException);
  });
});
