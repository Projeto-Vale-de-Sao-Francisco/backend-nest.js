import { PATH_METADATA } from '@nestjs/common/constants';
import { describe, expect, it } from 'vitest';
import { DevicesController } from './devices.controller.js';

describe('DevicesController credential routes', () => {
  it('does not expose credential issuance or rotation through the API', () => {
    const prototype = DevicesController.prototype as Record<string, unknown>;
    const paths = Object.getOwnPropertyNames(prototype).flatMap((name) => {
      const handler = prototype[name];
      return typeof handler === 'function'
        ? [Reflect.getMetadata(PATH_METADATA, handler)]
        : [];
    });

    expect(paths).toContain(':id/credential');
    expect(paths).not.toContain(':id/credential/rotate');
  });
});
