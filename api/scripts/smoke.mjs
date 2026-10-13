import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const bash = process.platform === 'win32'
  ? ['C:\\Program Files\\Git\\bin\\bash.exe', 'C:\\Program Files\\Git\\usr\\bin\\bash.exe'].find(existsSync)
  : 'bash';

if (!bash) {
  console.error('Git Bash não encontrado. Instale o Git for Windows ou execute scripts/smoke.sh em um ambiente Bash.');
  process.exit(1);
}

const result = spawnSync(bash, ['scripts/smoke.sh'], { stdio: 'inherit', env: process.env });
process.exit(result.status ?? 1);
