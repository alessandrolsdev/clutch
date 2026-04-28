import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';

const TOKEN_PREFIX = 'enc:v1';
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;
const DEFAULT_DEVELOPMENT_SECRET = 'clutch-connected-account-dev-secret';

function resolveTokenProtectionSecret(): string {
  const configuredSecret = process.env['CONNECTED_ACCOUNT_TOKEN_SECRET']?.trim()
    ?? process.env['JWT_SECRET']?.trim();

  if (configuredSecret && configuredSecret.length > 0) {
    return configuredSecret;
  }

  if (process.env['NODE_ENV'] === 'production') {
    throw new Error('CONNECTED_ACCOUNT_TOKEN_SECRET deve ser configurado em produção.');
  }

  return DEFAULT_DEVELOPMENT_SECRET;
}

function resolveEncryptionKey(): Buffer {
  return createHash('sha256').update(resolveTokenProtectionSecret()).digest();
}

export function protectSensitiveToken(token: string | null | undefined): string | null {
  if (typeof token !== 'string' || token.length === 0) {
    return null;
  }

  if (token.startsWith(`${TOKEN_PREFIX}:`)) {
    return token;
  }

  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', resolveEncryptionKey(), iv, {
    authTagLength: AUTH_TAG_BYTES,
  });
  const ciphertext = Buffer.concat([
    cipher.update(token, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    TOKEN_PREFIX,
    iv.toString('base64url'),
    authTag.toString('base64url'),
    ciphertext.toString('base64url'),
  ].join(':');
}

export function revealSensitiveToken(protectedToken: string | null | undefined): string | null {
  if (typeof protectedToken !== 'string' || protectedToken.length === 0) {
    return null;
  }

  if (!protectedToken.startsWith(`${TOKEN_PREFIX}:`)) {
    return protectedToken;
  }

  const [, , encodedIv, encodedAuthTag, encodedCiphertext] = protectedToken.split(':');

  if (!encodedIv || !encodedAuthTag || !encodedCiphertext) {
    throw new Error('Token protegido inválido.');
  }

  const decipher = createDecipheriv(
    'aes-256-gcm',
    resolveEncryptionKey(),
    Buffer.from(encodedIv, 'base64url'),
    { authTagLength: AUTH_TAG_BYTES },
  );
  decipher.setAuthTag(Buffer.from(encodedAuthTag, 'base64url'));

  return Buffer.concat([
    decipher.update(Buffer.from(encodedCiphertext, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}
