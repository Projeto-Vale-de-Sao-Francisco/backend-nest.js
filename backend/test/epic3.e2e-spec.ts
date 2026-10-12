import { INestApplication, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { AuthzService } from '../src/auth/authz.service.js';
import { PrincipalGuard } from '../src/auth/principal.guard.js';
import { CompaniesController } from '../src/companies/companies.controller.js';
import { CompaniesService } from '../src/companies/companies.service.js';
import { PropertiesController } from '../src/properties/properties.controller.js';
import { PropertiesService } from '../src/properties/properties.service.js';

describe('Epic 3 HTTP routes (e2e with mocked persistence)', () => {
  describe('companies', () => {
    let app: INestApplication<App>;
    const service = {
      create: vi.fn(),
      findAll: vi.fn(),
      findOne: vi.fn(),
      update: vi.fn(),
      updateStatus: vi.fn(),
      listUsers: vi.fn(),
      listAvailableUsers: vi.fn(),
      linkUser: vi.fn(),
      unlinkUser: vi.fn(),
    };

    beforeAll(async () => {
      const moduleFixture: TestingModule = await Test.createTestingModule({
        controllers: [CompaniesController],
        providers: [
          { provide: CompaniesService, useValue: service },
          PrincipalGuard,
          {
            provide: AuthzService,
            useValue: {
              assertActiveUser: vi.fn().mockResolvedValue(undefined),
            },
          },
        ],
      }).compile();

      app = moduleFixture.createNestApplication();
      app.use((req: any, _res: any, next: () => void) => {
        req.user = { id: 77 };
        next();
      });
      await app.init();
    });

    beforeEach(() => {
      vi.clearAllMocks();
    });

    afterAll(async () => {
      await app?.close();
    });

    it('routes company creation through the implemented alias', async () => {
      service.create.mockResolvedValue({ id: 1 });

      await request(app.getHttpServer())
        .post('/companies')
        .send({ name: 'Produtor teste' })
        .expect(201)
        .expect({ id: 1 });

      expect(service.create).toHaveBeenCalledWith(77, {
        name: 'Produtor teste',
      });
    });

    it('routes company filters to the listing service', async () => {
      service.findAll.mockResolvedValue({
        data: [],
        meta: { page: 2, limit: 5, total: 0, totalPages: 0 },
      });

      await request(app.getHttpServer())
        .get(
          '/empresas?search=Vale&type=pj&city=Petrolina&state=PE&status=ativo&page=2&limit=5',
        )
        .expect(200)
        .expect({
          data: [],
          meta: { page: 2, limit: 5, total: 0, totalPages: 0 },
        });

      expect(service.findAll).toHaveBeenCalledWith(
        77,
        {
          search: 'Vale',
          type: 'pj',
          city: 'Petrolina',
          state: 'PE',
          status: 'ativo',
        },
        { page: '2', limit: '5' },
      );
    });

    it('routes company read, update, inactivation and reactivation requests', async () => {
      service.findOne.mockResolvedValue({ id: 1 });
      service.update.mockResolvedValue({ id: 1, razao_social: 'Atualizado' });
      service.updateStatus.mockResolvedValue({ id: 1, status: 'ativo' });

      await request(app.getHttpServer()).get('/produtores/1').expect(200);
      await request(app.getHttpServer())
        .patch('/companies/1')
        .send({ name: 'Atualizado' })
        .expect(200);
      await request(app.getHttpServer())
        .patch('/companies/1/status')
        .send({ status: 'inativo' })
        .expect(200);
      await request(app.getHttpServer())
        .patch('/companies/1/status')
        .send({ status: 'ativo' })
        .expect(200);

      expect(service.findOne).toHaveBeenCalledWith(77, 1);
      expect(service.update).toHaveBeenCalledWith(77, 1, {
        name: 'Atualizado',
      });
      expect(service.updateStatus).toHaveBeenNthCalledWith(1, 77, 1, 'inativo');
      expect(service.updateStatus).toHaveBeenNthCalledWith(2, 77, 1, 'ativo');
    });

    it('routes company association list/create and rejects invalid path IDs', async () => {
      service.listUsers.mockResolvedValue([]);
      service.listAvailableUsers.mockResolvedValue([]);
      service.linkUser.mockResolvedValue({ id: 2 });
      service.unlinkUser.mockResolvedValue({ id: 2, status: 'inativo' });

      await request(app.getHttpServer())
        .get('/companies/1/associacoes')
        .expect(200)
        .expect([]);
      await request(app.getHttpServer())
        .get('/companies/1/usuarios')
        .expect(200)
        .expect([]);
      await request(app.getHttpServer())
        .get('/companies/1/usuarios/disponiveis')
        .expect(200)
        .expect([]);
      await request(app.getHttpServer())
        .post('/companies/1/usuarios')
        .send({ userId: 2 })
        .expect(201)
        .expect({ id: 2 });
      await request(app.getHttpServer())
        .post('/companies/1/associacoes')
        .send({ userId: 2 })
        .expect(201)
        .expect({ id: 2 });
      await request(app.getHttpServer())
        .delete('/companies/1/usuarios/2')
        .expect(200)
        .expect({ id: 2, status: 'inativo' });
      await request(app.getHttpServer())
        .get('/companies/not-an-id')
        .expect(400);

      expect(service.listUsers).toHaveBeenCalledWith(77, 1);
      expect(service.listAvailableUsers).toHaveBeenCalledWith(77, 1);
      expect(service.linkUser).toHaveBeenCalledWith(77, 1, { userId: 2 });
      expect(service.unlinkUser).toHaveBeenCalledWith(77, 1, 2);
    });

    it('returns the not-found status raised by the service', async () => {
      service.findOne.mockRejectedValue(new NotFoundException('Not found'));

      await request(app.getHttpServer()).get('/companies/404').expect(404);
    });
  });

  describe('properties', () => {
    let app: INestApplication<App>;
    const service = {
      create: vi.fn(),
      findAll: vi.fn(),
      findOne: vi.fn(),
      update: vi.fn(),
      updateStatus: vi.fn(),
      listUsers: vi.fn(),
      linkUser: vi.fn(),
      listAvailableUsers: vi.fn(),
      unlinkUser: vi.fn(),
      findAccessibleByUser: vi.fn(),
    };

    beforeAll(async () => {
      const moduleFixture: TestingModule = await Test.createTestingModule({
        controllers: [PropertiesController],
        providers: [
          { provide: PropertiesService, useValue: service },
          PrincipalGuard,
          {
            provide: AuthzService,
            useValue: {
              assertActiveUser: vi.fn().mockResolvedValue(undefined),
            },
          },
        ],
      }).compile();

      app = moduleFixture.createNestApplication();
      app.use((req: any, _res: any, next: () => void) => {
        req.user = { id: 77 };
        next();
      });
      await app.init();
    });

    beforeEach(() => {
      vi.clearAllMocks();
    });

    afterAll(async () => {
      await app?.close();
    });

    it('routes property creation and filtering through the implemented aliases', async () => {
      service.create.mockResolvedValue({ id: 5 });
      service.findAll.mockResolvedValue({
        data: [],
        meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
      });

      await request(app.getHttpServer())
        .post('/properties')
        .send({ name: 'Fazenda teste' })
        .expect(201)
        .expect({ id: 5 });
      await request(app.getHttpServer())
        .get(
          '/propriedades?search=Fazenda&companyId=12&municipality=Petrolina&state=PE&status=ativo',
        )
        .expect(200)
        .expect({
          data: [],
          meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
        });

      expect(service.create).toHaveBeenCalledWith(77, {
        name: 'Fazenda teste',
      });
      expect(service.findAll).toHaveBeenCalledWith(
        77,
        {
          search: 'Fazenda',
          companyId: 12,
          municipality: 'Petrolina',
          state: 'PE',
          status: 'ativo',
        },
        { page: undefined, limit: undefined },
      );
    });

    it('routes property read, update, inactivation and reactivation requests', async () => {
      service.findOne.mockResolvedValue({ id: 5 });
      service.update.mockResolvedValue({ id: 5, nome: 'Fazenda atualizada' });
      service.updateStatus.mockResolvedValue({ id: 5, status: 'ativo' });

      await request(app.getHttpServer()).get('/properties/5').expect(200);
      await request(app.getHttpServer())
        .patch('/properties/5')
        .send({ name: 'Fazenda atualizada' })
        .expect(200);
      await request(app.getHttpServer())
        .patch('/properties/5/status')
        .send({ status: 'inativo' })
        .expect(200);
      await request(app.getHttpServer())
        .patch('/properties/5/status')
        .send({ status: 'ativo' })
        .expect(200);

      expect(service.findOne).toHaveBeenCalledWith(77, 5);
      expect(service.update).toHaveBeenCalledWith(77, 5, {
        name: 'Fazenda atualizada',
      });
      expect(service.updateStatus).toHaveBeenNthCalledWith(1, 77, 5, 'inativo');
      expect(service.updateStatus).toHaveBeenNthCalledWith(2, 77, 5, 'ativo');
    });

    it('routes property-user associations and validates numeric IDs', async () => {
      service.listUsers.mockResolvedValue([]);
      service.listAvailableUsers.mockResolvedValue([]);
      service.linkUser.mockResolvedValue({ id: 3 });
      service.unlinkUser.mockResolvedValue({ id: 3, status: 'inativo' });
      service.findAccessibleByUser.mockResolvedValue({
        data: [],
        meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
      });

      await request(app.getHttpServer())
        .get('/properties/por-usuario/77')
        .expect(200);
      await request(app.getHttpServer())
        .get('/properties/5/usuarios')
        .expect(200)
        .expect([]);
      await request(app.getHttpServer())
        .get('/properties/5/usuarios/disponiveis')
        .expect(200)
        .expect([]);
      await request(app.getHttpServer())
        .get('/properties/5/associacoes')
        .expect(200)
        .expect([]);
      await request(app.getHttpServer())
        .post('/properties/5/associacoes')
        .send({ userId: 3 })
        .expect(201)
        .expect({ id: 3 });
      await request(app.getHttpServer())
        .post('/properties/5/usuarios')
        .send({ userId: 3 })
        .expect(201)
        .expect({ id: 3 });
      await request(app.getHttpServer())
        .delete('/properties/5/usuarios/3')
        .expect(200)
        .expect({ id: 3, status: 'inativo' });
      await request(app.getHttpServer()).get('/properties/bad-id').expect(400);

      expect(service.findAccessibleByUser).toHaveBeenCalledWith(77, 77, {
        page: undefined,
        limit: undefined,
      });
      expect(service.listUsers).toHaveBeenCalledWith(77, 5);
      expect(service.listAvailableUsers).toHaveBeenCalledWith(77, 5);
      expect(service.linkUser).toHaveBeenCalledWith(77, 5, { userId: 3 });
      expect(service.unlinkUser).toHaveBeenCalledWith(77, 5, 3);
    });

    it('returns the not-found status raised by the service', async () => {
      service.findOne.mockRejectedValue(new NotFoundException('Not found'));

      await request(app.getHttpServer()).get('/properties/404').expect(404);
    });
  });
});
