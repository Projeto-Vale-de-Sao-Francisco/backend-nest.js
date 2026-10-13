import { createHash, randomBytes } from 'node:crypto';

// Chave de dispositivo: aleatoria de 192 bits, mostrada uma unica vez; no banco fica so o SHA-256.
export const gerarChaveApi = () => `sv_${randomBytes(24).toString('hex')}`;
export const hashChave = (chave: string) => createHash('sha256').update(chave).digest('hex');
