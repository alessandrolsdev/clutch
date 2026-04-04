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

const JWT_ALGORITHM = 'HS256';
const DEFAULT_DEVELOPMENT_JWT_SECRET = 'clutch-dev-secret-change-in-production';
const BEARER_TOKEN_PATTERN = /^Bearer (?<token>[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/u;

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

export function createJwtSigner(secret?: string) {
  const resolvedSecret = resolveJwtSecret(secret);

  return (payload: JwtPayload): string => {
    const signOptions: SignOptions = {
      algorithm: JWT_ALGORITHM,
      expiresIn: '7d',
    };

    return jwt.sign(payload, resolvedSecret, signOptions);
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
