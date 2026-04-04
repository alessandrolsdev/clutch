import jwt, {
  type JwtPayload as JsonWebTokenPayload,
  type Secret,
  type SignOptions,
  type VerifyOptions,
} from 'jsonwebtoken';

export interface JwtPayload {
  id: string;
  username: string;
}

export interface RefreshTokenPayload extends JwtPayload {
  tokenType: 'refresh';
  sessionId: string;
  jti: string;
}

const JWT_ALGORITHM = 'HS256';
const DEFAULT_DEVELOPMENT_JWT_SECRET = 'clutch-dev-secret-change-in-production';
const BEARER_TOKEN_PATTERN = /^Bearer (?<token>[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/u;
const DEFAULT_ACCESS_TOKEN_TTL_SECONDS = 60 * 15;
const DEFAULT_REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7;

function resolveJwtSecret(secret?: string): Secret {
  if (typeof secret === 'string' && secret.trim().length > 0) {
    return secret;
  }

  const environmentSecret = process.env['JWT_SECRET'];

  if (typeof environmentSecret === 'string' && environmentSecret.trim().length > 0) {
    return environmentSecret;
  }

  if (process.env['NODE_ENV'] === 'production') {
    throw new Error('JWT_SECRET deve ser configurado em produção.');
  }

  return DEFAULT_DEVELOPMENT_JWT_SECRET;
}

function isJwtPayload(payload: string | JsonWebTokenPayload): payload is JsonWebTokenPayload {
  return typeof payload !== 'string';
}

function assertJwtPayload(payload: string | JsonWebTokenPayload): JwtPayload {
  if (!isJwtPayload(payload)) {
    throw new Error('Token JWT invalido.');
  }

  const { id, username } = payload;

  if (typeof id !== 'string' || typeof username !== 'string') {
    throw new Error('Payload JWT invalido.');
  }

  return { id, username };
}

function resolveAccessTokenTtlSeconds(): number {
  const rawValue = process.env['ACCESS_TOKEN_TTL_SECONDS'];
  const parsedValue = rawValue ? Number(rawValue) : Number.NaN;

  if (Number.isFinite(parsedValue) && parsedValue > 0) {
    return Math.floor(parsedValue);
  }

  return DEFAULT_ACCESS_TOKEN_TTL_SECONDS;
}

function resolveRefreshTokenTtlSeconds(): number {
  const rawValue = process.env['REFRESH_TOKEN_TTL_SECONDS'];
  const parsedValue = rawValue ? Number(rawValue) : Number.NaN;

  if (Number.isFinite(parsedValue) && parsedValue > 0) {
    return Math.floor(parsedValue);
  }

  return DEFAULT_REFRESH_TOKEN_TTL_SECONDS;
}

function assertRefreshTokenPayload(payload: string | JsonWebTokenPayload): RefreshTokenPayload {
  if (!isJwtPayload(payload)) {
    throw new Error('Refresh token invalido.');
  }

  const { id, username, tokenType, sessionId, jti } = payload;

  if (
    typeof id !== 'string' ||
    typeof username !== 'string' ||
    tokenType !== 'refresh' ||
    typeof sessionId !== 'string' ||
    typeof jti !== 'string'
  ) {
    throw new Error('Payload de refresh token invalido.');
  }

  return {
    id,
    username,
    tokenType,
    sessionId,
    jti,
  };
}

export function createJwtSigner(secret?: string) {
  const resolvedSecret = resolveJwtSecret(secret);

  return (payload: JwtPayload): string => {
    const signOptions: SignOptions = {
      algorithm: JWT_ALGORITHM,
      expiresIn: `${resolveAccessTokenTtlSeconds()}s`,
    };

    return jwt.sign(
      {
        ...payload,
        tokenType: 'access',
      },
      resolvedSecret,
      signOptions,
    );
  };
}

export function createJwtVerifier(secret?: string) {
  const resolvedSecret = resolveJwtSecret(secret);

  return (token: string): JwtPayload => {
    const verifyOptions: VerifyOptions = {
      algorithms: [JWT_ALGORITHM],
      ignoreExpiration: false,
    };

    const payload = jwt.verify(token, resolvedSecret, verifyOptions);

    return assertJwtPayload(payload);
  };
}

export function createRefreshTokenSigner(secret?: string) {
  const resolvedSecret = resolveJwtSecret(secret);

  return (payload: RefreshTokenPayload): string => {
    const signOptions: SignOptions = {
      algorithm: JWT_ALGORITHM,
      expiresIn: `${resolveRefreshTokenTtlSeconds()}s`,
    };

    return jwt.sign(payload, resolvedSecret, signOptions);
  };
}

export function createRefreshTokenVerifier(secret?: string) {
  const resolvedSecret = resolveJwtSecret(secret);

  return (token: string): RefreshTokenPayload => {
    const verifyOptions: VerifyOptions = {
      algorithms: [JWT_ALGORITHM],
      ignoreExpiration: false,
    };

    const payload = jwt.verify(token, resolvedSecret, verifyOptions);

    return assertRefreshTokenPayload(payload);
  };
}

export function extractBearerToken(authorizationHeader?: string): string | null {
  if (typeof authorizationHeader !== 'string' || authorizationHeader.length === 0) {
    return null;
  }

  const match = BEARER_TOKEN_PATTERN.exec(authorizationHeader);

  if (!match?.groups?.['token']) {
    return null;
  }

  return match.groups['token'];
}
