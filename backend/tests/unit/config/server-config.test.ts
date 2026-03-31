import { describe, expect, it } from 'vitest';
import { DEFAULT_PORT, resolveServerPort } from '../../../src/config/server-config';

describe('server-config', () => {
  it('retorna a porta padrão quando PORT não está definida', () => {
    expect(resolveServerPort(undefined)).toBe(3344);
    expect(DEFAULT_PORT).toBe(3344);
  });

  it('retorna a porta configurada quando PORT é válida', () => {
    expect(resolveServerPort('4444')).toBe(4444);
  });

  it('retorna a porta padrão quando PORT é inválida', () => {
    expect(resolveServerPort('abc')).toBe(DEFAULT_PORT);
    expect(resolveServerPort('0')).toBe(DEFAULT_PORT);
    expect(resolveServerPort('-1')).toBe(DEFAULT_PORT);
    expect(resolveServerPort('70000')).toBe(DEFAULT_PORT);
  });
});
