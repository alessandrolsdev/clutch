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

function resolveJwtSecret(secret?: string): Secret {
  return secret ?? process.env['JWT_SECRET'] ?? 'clutch-dev-secret-change-in-production';
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
    };

    const payload = jwt.verify(token, resolvedSecret, verifyOptions);

    return assertJwtPayload(payload);
  };
}

export function extractBearerToken(authorizationHeader?: string): string | null {
  if (!authorizationHeader) {
    return null;
  }

  const [scheme, token] = authorizationHeader.split(' ');

  if (scheme !== 'Bearer' || typeof token !== 'string' || token.length === 0) {
    return null;
  }

  return token;
}
