import { describe, expect, it } from 'vitest';
import jwt from 'jsonwebtoken';
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

  it('fixa o algoritmo HS256 na assinatura', () => {
    const signAccessToken = createJwtSigner(secret);
    const token = signAccessToken({
      id: 'user-id-1',
      username: 'clutchplayer',
    });

    const decoded = jwt.decode(token, { complete: true });

    expect(decoded).toMatchObject({
      header: {
        alg: 'HS256',
        typ: 'JWT',
      },
    });
  });

  it('rejeita token invalido', () => {
    const verifyAccessToken = createJwtVerifier(secret);

    expect(() => verifyAccessToken('token-invalido')).toThrow();
  });

  it('rejeita token expirado', () => {
    const verifyAccessToken = createJwtVerifier(secret);
    const expiredToken = jwt.sign(
      {
        id: 'user-id-1',
        username: 'clutchplayer',
      },
      secret,
      {
        algorithm: 'HS256',
        expiresIn: -1,
      },
    );

    expect(() => verifyAccessToken(expiredToken)).toThrow();
  });

  it('rejeita token assinado com algoritmo diferente', () => {
    const verifyAccessToken = createJwtVerifier(secret);
    const token = jwt.sign(
      {
        id: 'user-id-1',
        username: 'clutchplayer',
      },
      secret,
      {
        algorithm: 'HS384',
        expiresIn: '7d',
      },
    );

    expect(() => verifyAccessToken(token)).toThrow();
  });

  it('rejeita token com payload string', () => {
    const verifyAccessToken = createJwtVerifier(secret);
    const token = jwt.sign('plain-string-payload', secret, {
      algorithm: 'HS256',
    });

    expect(() => verifyAccessToken(token)).toThrow();
  });

  it('extrai apenas bearer token valido', () => {
    const validToken = createJwtSigner(secret)({
      id: 'user-id-1',
      username: 'clutchplayer',
    });

    expect(extractBearerToken(`Bearer ${validToken}`)).toBe(validToken);
    expect(extractBearerToken('Basic valid-token')).toBeNull();
    expect(extractBearerToken('bearer valid-token')).toBeNull();
    expect(extractBearerToken(`Bearer ${validToken} extra`)).toBeNull();
    expect(extractBearerToken(`Bearer  ${validToken}`)).toBeNull();
    expect(extractBearerToken(undefined)).toBeNull();
  });

  it('falha em produção quando JWT_SECRET não está configurado', () => {
    const previousNodeEnv = process.env['NODE_ENV'];
    const previousSecret = process.env['JWT_SECRET'];

    process.env['NODE_ENV'] = 'production';
    delete process.env['JWT_SECRET'];

    try {
      expect(() => createJwtSigner()).toThrow('JWT_SECRET deve ser configurado em produção.');
      expect(() => createJwtVerifier()).toThrow('JWT_SECRET deve ser configurado em produção.');
    } finally {
      if (typeof previousNodeEnv === 'string') {
        process.env['NODE_ENV'] = previousNodeEnv;
      } else {
        delete process.env['NODE_ENV'];
      }

      if (typeof previousSecret === 'string') {
        process.env['JWT_SECRET'] = previousSecret;
      } else {
        delete process.env['JWT_SECRET'];
      }
    }
  });
});
