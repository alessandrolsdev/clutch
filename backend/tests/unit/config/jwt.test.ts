import { describe, expect, it } from 'vitest';
import {
  createJwtSigner,
  createJwtVerifier,
  extractBearerToken,
} from '@/config/jwt';

describe('JWT config', () => {
  const secret = 'clutch-test-secret';

  it('assina e valida um token com payload esperado', () => {
    const signAccessToken = createJwtSigner(secret);
    const verifyAccessToken = createJwtVerifier(secret);

    const token = signAccessToken({
      id: 'user-id-1',
      username: 'clutchplayer',
    });

    expect(verifyAccessToken(token)).toEqual({
      id: 'user-id-1',
      username: 'clutchplayer',
    });
  });

  it('rejeita token invalido', () => {
    const verifyAccessToken = createJwtVerifier(secret);

    expect(() => verifyAccessToken('token-invalido')).toThrow();
  });

  it('extrai apenas bearer token valido', () => {
    expect(extractBearerToken('Bearer valid-token')).toBe('valid-token');
    expect(extractBearerToken('Basic valid-token')).toBeNull();
    expect(extractBearerToken(undefined)).toBeNull();
  });
});
