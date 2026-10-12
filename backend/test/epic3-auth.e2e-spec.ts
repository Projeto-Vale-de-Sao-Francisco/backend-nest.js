import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { AuthzService } from '../src/auth/authz.service.js';
import { PrincipalGuard } from '../src/auth/principal.guard.js';
import { CompaniesController } from '../src/companies/companies.controller.js';
import { CompaniesService } from '../src/companies/companies.service.js';

describe('Epic 3 authentication boundary (e2e)', () => {
  let app: INestApplication<App>;
  const service = { findAll: vi.fn() };
  const authz = { assertActiveUser: vi.fn() };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [CompaniesController],
      providers: [
        { provide: CompaniesService, useValue: service },
        PrincipalGuard,
        { provide: AuthzService, useValue: authz },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('rejects an unauthenticated request before reaching the service', async () => {
    await request(app.getHttpServer()).get('/companies').expect(401);

    expect(authz.assertActiveUser).not.toHaveBeenCalled();
    expect(service.findAll).not.toHaveBeenCalled();
  });
});
