import { describe, expect, it } from 'vitest';
import { isCpfValido } from './is-cpf.validator.js';

describe('isCpfValido', () => {
  it('aceita CPFs válidos com onze dígitos', () => {
    expect(isCpfValido('52998224725')).toBe(true);
    expect(isCpfValido('11144477735')).toBe(true);
  });

  it('rejeita CPF com dígitos verificadores inválidos', () => {
    expect(isCpfValido('52998224724')).toBe(false);
  });

  it('rejeita sequências repetidas e valores fora do formato normalizado', () => {
    expect(isCpfValido('11111111111')).toBe(false);
    expect(isCpfValido('529.982.247-25')).toBe(false);
    expect(isCpfValido('5299822472')).toBe(false);
  });
});
