import { describe, expect, it, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import {
  createRefreshTokenSigner,
  createRefreshTokenVerifier,
  getAccessTokenTtlSeconds,
  createJwtSigner,
  createJwtVerifier,
  extractBearerToken,
  JwtKidRejectedError,
  JwtRotationConfigError,
  type JwtKeyRotationConfig,
} from '@/config/jwt';

type JsonLogEntry = Record<string, unknown>;

function captureJsonLogs() {
  const entries: JsonLogEntry[] = [];

  const collect = (chunk: string | Uint8Array): boolean => {
    const serialized = typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8');

    for (const line of serialized.split('\n')) {
      const trimmed = line.trim();

      if (!trimmed.startsWith('{')) {
        continue;
      }

      try {
        entries.push(JSON.parse(trimmed) as JsonLogEntry);
      } catch {
        // Ignora linhas nao-JSON emitidas por bibliotecas.
      }
    }

    return true;
  };

  const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(((chunk: string | Uint8Array) => collect(chunk)) as typeof process.stdout.write);
  const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(((chunk: string | Uint8Array) => collect(chunk)) as typeof process.stderr.write);

  return {
    entries,
    restore() {
      stdoutSpy.mockRestore();
      stderrSpy.mockRestore();
    },
  };
}

describe('JWT config', () => {
  const secret = 'clutch-test-secret';
  const keyRotationConfig: JwtKeyRotationConfig = {
    activeKid: 'v2',
    keys: {
      v1: 'clutch-legacy-secret',
      v2: secret,
    },
  };

  it('assina e valida um token com payload esperado', () => {
    const signAccessToken = createJwtSigner(secret);
    const verifyAccessToken = createJwtVerifier(secret);

    const token = signAccessToken({
      id: 'user-id-1',
      username: 'clutchplayer',
    });

    expect(verifyAccessToken(token)).toMatchObject({
      id: 'user-id-1',
      username: 'clutchplayer',
      keyId: 'legacy',
      tokenKeyId: 'legacy',
      legacyToken: false,
      issuerPresent: true,
      audiencePresent: true,
      notBeforePresent: true,
    });
  });

  it('assina access token com kid da chave ativa', () => {
    const signAccessToken = createJwtSigner(keyRotationConfig);
    const token = signAccessToken({
      id: 'user-id-1',
      username: 'clutchplayer',
    });

    const decoded = jwt.decode(token, { complete: true });

    expect(decoded).toMatchObject({
      header: {
        alg: 'HS256',
        kid: 'v2',
        typ: 'JWT',
      },
      payload: {
        iss: 'clutch.backend',
        aud: 'clutch.auth',
      },
    });
    const payload = (decoded as jwt.Jwt | null)?.payload;
    expect(payload && typeof payload !== 'string' ? typeof payload.nbf : 'undefined').toBe('number');
  });

  it('assina e valida refresh token com kid, sessionId e jti', () => {
    const signRefreshToken = createRefreshTokenSigner(keyRotationConfig);
    const verifyRefreshToken = createRefreshTokenVerifier(keyRotationConfig);

    const token = signRefreshToken({
      id: 'user-id-1',
      username: 'clutchplayer',
      tokenType: 'refresh',
      sessionId: 'session-1',
      jti: 'refresh-1',
    });

    expect(verifyRefreshToken(token)).toMatchObject({
      id: 'user-id-1',
      username: 'clutchplayer',
      tokenType: 'refresh',
      sessionId: 'session-1',
      jti: 'refresh-1',
      keyId: 'v2',
      tokenKeyId: 'v2',
      legacyToken: false,
      issuerPresent: true,
      audiencePresent: true,
      notBeforePresent: true,
    });
  });

  it('aceita token legado sem kid usando uma chave valida configurada', () => {
    const verifyAccessToken = createJwtVerifier(keyRotationConfig);
    const legacyToken = jwt.sign(
      {
        id: 'user-id-1',
        username: 'clutchplayer',
        tokenType: 'access',
      },
      keyRotationConfig.keys.v1!,
      {
        algorithm: 'HS256',
        expiresIn: '10m',
      },
    );

    expect(verifyAccessToken(legacyToken)).toMatchObject({
      id: 'user-id-1',
      username: 'clutchplayer',
      keyId: 'v1',
      tokenKeyId: null,
      legacyToken: true,
      issuerPresent: false,
      audiencePresent: false,
      notBeforePresent: false,
    });
  });

  it('aceita token com issuer valida', () => {
    const verifyAccessToken = createJwtVerifier(secret);
    const token = jwt.sign(
      {
        id: 'user-id-1',
        username: 'clutchplayer',
      },
      secret,
      {
        algorithm: 'HS256',
        expiresIn: '10m',
        issuer: 'clutch.backend',
        audience: 'clutch.auth',
        notBefore: 0,
        header: {
          alg: 'HS256',
          kid: 'legacy',
        },
      },
    );

    expect(verifyAccessToken(token)).toMatchObject({
      id: 'user-id-1',
      username: 'clutchplayer',
      issuerPresent: true,
      audiencePresent: true,
      notBeforePresent: true,
    });
  });

  it('rejeita token com issuer invalida', () => {
    const verifyAccessToken = createJwtVerifier(secret);
    const token = jwt.sign(
      {
        id: 'user-id-1',
        username: 'clutchplayer',
      },
      secret,
      {
        algorithm: 'HS256',
        expiresIn: '10m',
        issuer: 'external.backend',
        audience: 'clutch.auth',
        notBefore: 0,
        header: {
          alg: 'HS256',
          kid: 'legacy',
        },
      },
    );

    expect(() => verifyAccessToken(token)).toThrow('JWT issuer invalido.');
  });

  it('rejeita token com audience invalida', () => {
    const verifyAccessToken = createJwtVerifier(secret);
    const token = jwt.sign(
      {
        id: 'user-id-1',
        username: 'clutchplayer',
      },
      secret,
      {
        algorithm: 'HS256',
        expiresIn: '10m',
        issuer: 'clutch.backend',
        audience: 'external-client',
        notBefore: 0,
        header: {
          alg: 'HS256',
          kid: 'legacy',
        },
      },
    );

    expect(() => verifyAccessToken(token)).toThrow('JWT audience invalida.');
  });

  it('rejeita token com nbf no futuro', () => {
    const verifyAccessToken = createJwtVerifier(secret);
    const token = jwt.sign(
      {
        id: 'user-id-1',
        username: 'clutchplayer',
      },
      secret,
      {
        algorithm: 'HS256',
        expiresIn: '10m',
        issuer: 'clutch.backend',
        audience: 'clutch.auth',
        notBefore: '30s',
        header: {
          alg: 'HS256',
          kid: 'legacy',
        },
      },
    );

    expect(() => verifyAccessToken(token)).toThrow();
  });

  it('rejeita token com kid desconhecido', () => {
    const verifyAccessToken = createJwtVerifier(keyRotationConfig);
    const token = jwt.sign(
      {
        id: 'user-id-1',
        username: 'clutchplayer',
        tokenType: 'access',
      },
      'kid-unknown-secret',
      {
        algorithm: 'HS256',
        expiresIn: '10m',
        header: {
          alg: 'HS256',
          kid: 'v999',
        },
      },
    );

    expect(() => verifyAccessToken(token)).toThrow(JwtKidRejectedError);
  });

  it('rejeita token com assinatura feita por chave nao reconhecida', () => {
    const verifyAccessToken = createJwtVerifier(keyRotationConfig);
    const token = jwt.sign(
      {
        id: 'user-id-1',
        username: 'clutchplayer',
        tokenType: 'access',
      },
      'wrong-active-secret',
      {
        algorithm: 'HS256',
        expiresIn: '10m',
        header: {
          alg: 'HS256',
          kid: 'v2',
        },
      },
    );

    expect(() => verifyAccessToken(token)).toThrow();
  });

  it('usa um TTL curto de 10 minutos para o access token', () => {
    const signAccessToken = createJwtSigner(secret);
    const token = signAccessToken({
      id: 'user-id-1',
      username: 'clutchplayer',
    });

    const decoded = jwt.decode(token) as jwt.JwtPayload | null;

    expect(getAccessTokenTtlSeconds()).toBe(60 * 10);
    expect(decoded?.exp).toBeTypeOf('number');
    expect(decoded?.iat).toBeTypeOf('number');
    expect((decoded?.exp ?? 0) - (decoded?.iat ?? 0)).toBe(60 * 10);
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
        header: {
          alg: 'HS256',
          kid: 'legacy',
        },
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
        header: {
          alg: 'HS384',
          kid: 'legacy',
        },
      },
    );

    expect(() => verifyAccessToken(token)).toThrow();
  });

  it('rejeita token com payload string', () => {
    const verifyAccessToken = createJwtVerifier(secret);
    const token = jwt.sign('plain-string-payload', secret, {
      algorithm: 'HS256',
      header: {
        alg: 'HS256',
        kid: 'legacy',
      },
    });

    expect(() => verifyAccessToken(token)).toThrow();
  });

  it('rejeita refresh token com payload incompleto', () => {
    const verifyRefreshToken = createRefreshTokenVerifier(secret);
    const token = jwt.sign(
      {
        id: 'user-id-1',
        username: 'clutchplayer',
      },
      secret,
      {
        algorithm: 'HS256',
        expiresIn: '7d',
        header: {
          alg: 'HS256',
          kid: 'legacy',
        },
      },
    );

    expect(() => verifyRefreshToken(token)).toThrow();
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

  it('falha em producao quando JWT_SECRET nao esta configurado', () => {
    const previousNodeEnv = process.env['NODE_ENV'];
    const previousSecret = process.env['JWT_SECRET'];
    const previousKeyring = process.env['JWT_KEYS_JSON'];
    const previousActiveKid = process.env['JWT_ACTIVE_KID'];
    const previousIssuer = process.env['JWT_ISSUER'];
    const previousAudience = process.env['JWT_AUDIENCE'];

    process.env['NODE_ENV'] = 'production';
    delete process.env['JWT_SECRET'];
    delete process.env['JWT_KEYS_JSON'];
    delete process.env['JWT_ACTIVE_KID'];
    delete process.env['JWT_ISSUER'];
    delete process.env['JWT_AUDIENCE'];

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

      if (typeof previousKeyring === 'string') {
        process.env['JWT_KEYS_JSON'] = previousKeyring;
      } else {
        delete process.env['JWT_KEYS_JSON'];
      }

      if (typeof previousActiveKid === 'string') {
        process.env['JWT_ACTIVE_KID'] = previousActiveKid;
      } else {
        delete process.env['JWT_ACTIVE_KID'];
      }

      if (typeof previousIssuer === 'string') {
        process.env['JWT_ISSUER'] = previousIssuer;
      } else {
        delete process.env['JWT_ISSUER'];
      }

      if (typeof previousAudience === 'string') {
        process.env['JWT_AUDIENCE'] = previousAudience;
      } else {
        delete process.env['JWT_AUDIENCE'];
      }
    }
  });

  it('falha em producao quando JWT_ISSUER nao esta configurado', () => {
    const previousNodeEnv = process.env['NODE_ENV'];
    const previousSecret = process.env['JWT_SECRET'];
    const previousIssuer = process.env['JWT_ISSUER'];
    const previousAudience = process.env['JWT_AUDIENCE'];

    process.env['NODE_ENV'] = 'production';
    process.env['JWT_SECRET'] = secret;
    delete process.env['JWT_ISSUER'];
    process.env['JWT_AUDIENCE'] = 'clutch.auth';

    try {
      expect(() => createJwtSigner()).toThrow('JWT_ISSUER deve ser configurado em produção.');
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

      if (typeof previousIssuer === 'string') {
        process.env['JWT_ISSUER'] = previousIssuer;
      } else {
        delete process.env['JWT_ISSUER'];
      }

      if (typeof previousAudience === 'string') {
        process.env['JWT_AUDIENCE'] = previousAudience;
      } else {
        delete process.env['JWT_AUDIENCE'];
      }
    }
  });

  it('falha em producao quando JWT_AUDIENCE nao esta configurado', () => {
    const previousNodeEnv = process.env['NODE_ENV'];
    const previousSecret = process.env['JWT_SECRET'];
    const previousIssuer = process.env['JWT_ISSUER'];
    const previousAudience = process.env['JWT_AUDIENCE'];

    process.env['NODE_ENV'] = 'production';
    process.env['JWT_SECRET'] = secret;
    process.env['JWT_ISSUER'] = 'clutch.backend';
    delete process.env['JWT_AUDIENCE'];

    try {
      expect(() => createJwtSigner()).toThrow('JWT_AUDIENCE deve ser configurado em produção.');
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

      if (typeof previousIssuer === 'string') {
        process.env['JWT_ISSUER'] = previousIssuer;
      } else {
        delete process.env['JWT_ISSUER'];
      }

      if (typeof previousAudience === 'string') {
        process.env['JWT_AUDIENCE'] = previousAudience;
      } else {
        delete process.env['JWT_AUDIENCE'];
      }
    }
  });

  it('falha quando a configuracao de rotacao aponta para active kid inexistente', () => {
    expect(() => createJwtSigner({
      activeKid: 'v2',
      keys: { v1: 'legacy-secret' },
    })).toThrow(JwtRotationConfigError);
  });

  it('falha quando multiplas chaves existem em ambiente e JWT_ACTIVE_KID nao esta configurado', () => {
    const previousNodeEnv = process.env['NODE_ENV'];
    const previousSecret = process.env['JWT_SECRET'];
    const previousKeyring = process.env['JWT_KEYS_JSON'];
    const previousActiveKid = process.env['JWT_ACTIVE_KID'];

    delete process.env['JWT_SECRET'];
    process.env['JWT_KEYS_JSON'] = JSON.stringify({
      v1: 'legacy-secret',
      v2: 'active-secret',
    });
    delete process.env['JWT_ACTIVE_KID'];

    try {
      expect(() => createJwtSigner()).toThrow(JwtRotationConfigError);
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

      if (typeof previousKeyring === 'string') {
        process.env['JWT_KEYS_JSON'] = previousKeyring;
      } else {
        delete process.env['JWT_KEYS_JSON'];
      }

      if (typeof previousActiveKid === 'string') {
        process.env['JWT_ACTIVE_KID'] = previousActiveKid;
      } else {
        delete process.env['JWT_ACTIVE_KID'];
      }
    }
  });

  it('loga a configuracao de rotacao sem expor o keyring nem segredos', () => {
    const previousNodeEnv = process.env['NODE_ENV'];
    process.env['NODE_ENV'] = 'development';
    const capturedLogs = captureJsonLogs();

    try {
      createJwtSigner({
        activeKid: 'audit-v2',
        keys: {
          'audit-v1': 'legacy-secret-audit',
          'audit-v2': 'active-secret-audit',
        },
      });
    } finally {
      capturedLogs.restore();

      if (typeof previousNodeEnv === 'string') {
        process.env['NODE_ENV'] = previousNodeEnv;
      } else {
        delete process.env['NODE_ENV'];
      }
    }

    const logEntry = capturedLogs.entries.find((entry) => entry.event === 'auth_jwt_rotation_config_loaded');

    expect(logEntry).toMatchObject({
      event: 'auth_jwt_rotation_config_loaded',
      activeKid: 'audit-v2',
      configuredKeyCount: 2,
    });
    expect(logEntry).not.toHaveProperty('configuredKids');
    expect(JSON.stringify(logEntry)).not.toContain('legacy-secret-audit');
    expect(JSON.stringify(logEntry)).not.toContain('active-secret-audit');
  });
});
