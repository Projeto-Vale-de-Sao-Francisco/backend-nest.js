import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('migrações do banco', () => {
  it('cria a coluna pressao declarada no modelo Medicao', () => {
    const migrationsDir = join(process.cwd(), 'prisma', 'migrations');
    const sql = readdirSync(migrationsDir)
      .map((dir) => join(migrationsDir, dir, 'migration.sql'))
      .filter(existsSync)
      .map((file) => readFileSync(file, 'utf8'))
      .join('\n');
    const criacaoMedicao = sql.match(/CREATE TABLE "Medicao" \(([\s\S]*?)\);/)?.[1] ?? '';
    const adicionadaDepois = /ALTER TABLE "Medicao" ADD COLUMN "pressao"/.test(sql);

    expect(criacaoMedicao.includes('"pressao"') || adicionadaDepois).toBe(true);
  });

  it('aplica migrações antes de iniciar o servidor de produção', () => {
    const packageJson = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8'));
    expect(packageJson.scripts['start:prod']).toContain('prisma migrate deploy');
  });
});
