import jwt, {
  type JwtPayload as JsonWebTokenPayload,
  type Secret,
  type SignOptions,
  type VerifyOptions,
} from 'jsonwebtoken';
import { writeBackendRuntimeLog } from './logging';

export interface JwtPayload {
  id: string;
  username: string;
}

export interface VerifiedJwtPayload extends JwtPayload {
  keyId: string;
  tokenKeyId: string | null;
  legacyToken: boolean;
  issuerPresent: boolean;
  audiencePresent: boolean;
  notBeforePresent: boolean;
}

export interface RefreshTokenPayload extends JwtPayload {
  tokenType: 'refresh';
  sessionId: string;
  jti: string;
}

export interface VerifiedRefreshTokenPayload extends RefreshTokenPayload {
  keyId: string;
  tokenKeyId: string | null;
  legacyToken: boolean;
  issuerPresent: boolean;
  audiencePresent: boolean;
  notBeforePresent: boolean;
}

export type JwtKeyRotationConfig = {
  activeKid: string;
  keys: Record<string, string>;
};

type ResolvedJwtKeyRotationConfig = {
  activeKid: string;
  keys: Record<string, Secret>;
  verificationOrder: string[];
};

type VerificationCandidate = {
  keyId: string;
  secret: Secret;
  legacyToken: boolean;
};

type JwtHeaderMetadata = {
  kid: string | null;
};

type JwtClaimConfig = {
  issuer: string;
  audience: string;
};

const JWT_ALGORITHM = 'HS256';
const DEFAULT_DEVELOPMENT_JWT_SECRET = 'clutch-dev-secret-change-in-production';
const DEFAULT_SINGLE_KEY_KID = 'legacy';
const JWT_KEYRING_ENV = 'JWT_KEYS_JSON';
const JWT_ACTIVE_KID_ENV = 'JWT_ACTIVE_KID';
const JWT_ISSUER_ENV = 'JWT_ISSUER';
const JWT_AUDIENCE_ENV = 'JWT_AUDIENCE';
const DEFAULT_JWT_ISSUER = 'clutch.backend';
const DEFAULT_JWT_AUDIENCE = 'clutch.auth';
const BEARER_TOKEN_PATTERN = /^Bearer (?<token>[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/u;
// 10 minutos reduz a janela de ataque sem forcar refresh excessivo em navegacao comum.
const DEFAULT_ACCESS_TOKEN_TTL_SECONDS = 60 * 10;
const DEFAULT_REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7;
const loggedKeyRotationConfigs = new Set<string>();

export class JwtRotationConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'JwtRotationConfigError';
  }
}

export class JwtKidRejectedError extends Error {
  readonly kid: string | null;
  readonly reason: 'unknown_kid';

  constructor(kid: string | null) {
    super('JWT kid invalido ou desconhecido.');
    this.name = 'JwtKidRejectedError';
    this.kid = kid;
    this.reason = 'unknown_kid';
  }
}

export class JwtIssuerRejectedError extends Error {
  readonly reason: 'invalid_issuer';

  constructor() {
    super('JWT issuer invalido.');
    this.name = 'JwtIssuerRejectedError';
    this.reason = 'invalid_issuer';
  }
}

export class JwtAudienceRejectedError extends Error {
  readonly reason: 'invalid_audience';

  constructor() {
    super('JWT audience invalida.');
    this.name = 'JwtAudienceRejectedError';
    this.reason = 'invalid_audience';
  }
}

function resolveJwtSecret(secret?: string): Secret {
  if (typeof secret === 'string' && secret.trim().length > 0) {
    return secret;
  }

  const environmentSecret = process.env['JWT_SECRET'];

  if (typeof environmentSecret === 'string' && environmentSecret.trim().length > 0) {
    return environmentSecret;
  }

  if (process.env['NODE_ENV'] === 'production') {
    throw new JwtRotationConfigError('JWT_SECRET deve ser configurado em produção.');
  }

  return DEFAULT_DEVELOPMENT_JWT_SECRET;
}

function resolveJwtClaimConfig(): JwtClaimConfig {
  const configuredIssuer = process.env[JWT_ISSUER_ENV]?.trim();
  const configuredAudience = process.env[JWT_AUDIENCE_ENV]?.trim();

  if (process.env['NODE_ENV'] === 'production') {
    if (!configuredIssuer || configuredIssuer.length === 0) {
      throw new JwtRotationConfigError('JWT_ISSUER deve ser configurado em produção.');
    }

    if (!configuredAudience || configuredAudience.length === 0) {
      throw new JwtRotationConfigError('JWT_AUDIENCE deve ser configurado em produção.');
    }
  }

  const issuer = configuredIssuer && configuredIssuer.length > 0
    ? configuredIssuer
    : DEFAULT_JWT_ISSUER;
  const audience = configuredAudience && configuredAudience.length > 0
    ? configuredAudience
    : DEFAULT_JWT_AUDIENCE;

  if (issuer.length === 0 || audience.length === 0) {
    throw new JwtRotationConfigError('JWT_ISSUER e JWT_AUDIENCE devem ser strings não vazias.');
  }

  return {
    issuer,
    audience,
  };
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

function resolveAccessTokenTtlSeconds(): number {
  const rawValue = process.env['ACCESS_TOKEN_TTL_SECONDS'];
  const parsedValue = rawValue ? Number(rawValue) : Number.NaN;

  if (Number.isFinite(parsedValue) && parsedValue > 0) {
    return Math.floor(parsedValue);
  }

  return DEFAULT_ACCESS_TOKEN_TTL_SECONDS;
}

export function getAccessTokenTtlSeconds(): number {
  return resolveAccessTokenTtlSeconds();
}

function resolveRefreshTokenTtlSeconds(): number {
  const rawValue = process.env['REFRESH_TOKEN_TTL_SECONDS'];
  const parsedValue = rawValue ? Number(rawValue) : Number.NaN;

  if (Number.isFinite(parsedValue) && parsedValue > 0) {
    return Math.floor(parsedValue);
  }

  return DEFAULT_REFRESH_TOKEN_TTL_SECONDS;
}

function resolveSingleKeyActiveKid(): string {
  const configuredKid = process.env[JWT_ACTIVE_KID_ENV];

  if (typeof configuredKid === 'string' && configuredKid.trim().length > 0) {
    return configuredKid.trim();
  }

  return DEFAULT_SINGLE_KEY_KID;
}

function parseJwtKeysJson(rawValue: string): Record<string, string> {
  let parsedValue: unknown;

  try {
    parsedValue = JSON.parse(rawValue) as unknown;
  } catch {
    throw new JwtRotationConfigError(`${JWT_KEYRING_ENV} deve conter JSON válido.`);
  }

  if (typeof parsedValue !== 'object' || parsedValue === null || Array.isArray(parsedValue)) {
    throw new JwtRotationConfigError(`${JWT_KEYRING_ENV} deve conter um objeto de chaves nomeadas.`);
  }

  const entries = Object.entries(parsedValue);

  if (entries.length === 0) {
    throw new JwtRotationConfigError(`${JWT_KEYRING_ENV} deve conter pelo menos uma chave JWT.`);
  }

  const keys: Record<string, string> = {};

  for (const [kid, secret] of entries) {
    if (typeof kid !== 'string' || kid.trim().length === 0) {
      throw new JwtRotationConfigError('Cada kid de JWT deve ser uma string não vazia.');
    }

    if (typeof secret !== 'string' || secret.trim().length === 0) {
      throw new JwtRotationConfigError(`A chave JWT associada ao kid "${kid}" deve ser uma string não vazia.`);
    }

    keys[kid.trim()] = secret.trim();
  }

  return keys;
}

function normalizeExplicitKeyRotationConfig(config: JwtKeyRotationConfig): ResolvedJwtKeyRotationConfig {
  const keys = Object.entries(config.keys).reduce<Record<string, Secret>>((accumulator, [kid, secret]) => {
    if (typeof kid !== 'string' || kid.trim().length === 0) {
      throw new JwtRotationConfigError('Cada kid de JWT deve ser uma string não vazia.');
    }

    if (typeof secret !== 'string' || secret.trim().length === 0) {
      throw new JwtRotationConfigError(`A chave JWT associada ao kid "${kid}" deve ser uma string não vazia.`);
    }

    accumulator[kid.trim()] = secret.trim();
    return accumulator;
  }, {});

  const verificationOrder = Object.keys(keys);

  if (verificationOrder.length === 0) {
    throw new JwtRotationConfigError('A configuração explícita de rotação JWT deve conter pelo menos uma chave.');
  }

  const activeKid = config.activeKid.trim();

  if (activeKid.length === 0) {
    throw new JwtRotationConfigError('A chave ativa JWT deve ser uma string não vazia.');
  }

  if (!Object.hasOwn(keys, activeKid)) {
    throw new JwtRotationConfigError('A chave ativa JWT deve existir no conjunto de chaves válidas.');
  }

  return {
    activeKid,
    keys,
    verificationOrder,
  };
}

function resolveJwtKeyRotationConfig(input?: string | JwtKeyRotationConfig): ResolvedJwtKeyRotationConfig {
  if (typeof input === 'object' && input !== null) {
    const resolvedConfig = normalizeExplicitKeyRotationConfig(input);
    logJwtRotationConfigLoaded(resolvedConfig);
    return resolvedConfig;
  }

  if (typeof input === 'string' && input.trim().length > 0) {
    const activeKid = resolveSingleKeyActiveKid();
    const resolvedConfig = {
      activeKid,
      keys: { [activeKid]: input.trim() },
      verificationOrder: [activeKid],
    };
    logJwtRotationConfigLoaded(resolvedConfig);
    return resolvedConfig;
  }

  const rawKeyring = process.env[JWT_KEYRING_ENV];

  if (typeof rawKeyring === 'string' && rawKeyring.trim().length > 0) {
    const parsedKeys = parseJwtKeysJson(rawKeyring.trim());
    const configuredActiveKid = process.env[JWT_ACTIVE_KID_ENV]?.trim();
    const verificationOrder = Object.keys(parsedKeys);

    if ((!configuredActiveKid || configuredActiveKid.length === 0) && verificationOrder.length > 1) {
      throw new JwtRotationConfigError('JWT_ACTIVE_KID deve ser configurado quando múltiplas chaves JWT estiverem ativas.');
    }

    const activeKid = configuredActiveKid && configuredActiveKid.length > 0
      ? configuredActiveKid
      : verificationOrder[0];

    if (typeof activeKid !== 'string' || activeKid.length === 0) {
      throw new JwtRotationConfigError('JWT_ACTIVE_KID deve ser configurado quando múltiplas chaves JWT estiverem ativas.');
    }

    if (!Object.hasOwn(parsedKeys, activeKid)) {
      throw new JwtRotationConfigError('JWT_ACTIVE_KID deve apontar para uma chave existente em JWT_KEYS_JSON.');
    }

    const resolvedConfig = {
      activeKid,
      keys: parsedKeys,
      verificationOrder,
    };
    logJwtRotationConfigLoaded(resolvedConfig);
    return resolvedConfig;
  }

  const resolvedSecret = resolveJwtSecret();
  const activeKid = resolveSingleKeyActiveKid();
  const resolvedConfig = {
    activeKid,
    keys: { [activeKid]: resolvedSecret },
    verificationOrder: [activeKid],
  };
  logJwtRotationConfigLoaded(resolvedConfig);
  return resolvedConfig;
}

function logJwtRotationConfigLoaded(config: ResolvedJwtKeyRotationConfig): void {
  if (process.env['NODE_ENV'] === 'test') {
    return;
  }

  const signature = JSON.stringify({
    activeKid: config.activeKid,
    kids: config.verificationOrder,
  });

  if (loggedKeyRotationConfigs.has(signature)) {
    return;
  }

  loggedKeyRotationConfigs.add(signature);

  writeBackendRuntimeLog('info', 'auth_jwt_rotation_config_loaded', 'JWT rotation config loaded', {
    activeKid: config.activeKid,
    configuredKeyCount: config.verificationOrder.length,
  });
}

function decodeJwtHeader(token: string): JwtHeaderMetadata {
  const decoded = jwt.decode(token, { complete: true });

  if (!decoded || typeof decoded !== 'object' || !('header' in decoded)) {
    throw new Error('Token JWT invalido.');
  }

  const rawKid = decoded.header['kid'];

  return {
    kid: typeof rawKid === 'string' && rawKid.trim().length > 0 ? rawKid.trim() : null,
  };
}

function decodeJwtPayload(token: string): JsonWebTokenPayload {
  const decoded = jwt.decode(token);

  if (!decoded || !isJwtPayload(decoded)) {
    throw new Error('Token JWT invalido.');
  }

  return decoded;
}

function resolveVerificationCandidates(
  config: ResolvedJwtKeyRotationConfig,
  tokenKeyId: string | null,
): VerificationCandidate[] {
  if (typeof tokenKeyId === 'string') {
    const secret = config.keys[tokenKeyId];

    if (!secret) {
      throw new JwtKidRejectedError(tokenKeyId);
    }

    return [{
      keyId: tokenKeyId,
      secret,
      legacyToken: false,
    }];
  }

  return config.verificationOrder.map((kid) => ({
    keyId: kid,
    secret: config.keys[kid] as Secret,
    legacyToken: true,
  }));
}

function verifyTokenAgainstCandidates<TPayload>(
  token: string,
  config: ResolvedJwtKeyRotationConfig,
  claimConfig: JwtClaimConfig,
  // eslint-disable-next-line no-unused-vars
  assertPayload: (_payload: string | JsonWebTokenPayload) => TPayload,
): TPayload & {
  keyId: string;
  tokenKeyId: string | null;
  legacyToken: boolean;
  issuerPresent: boolean;
  audiencePresent: boolean;
  notBeforePresent: boolean;
} {
  const tokenHeader = decodeJwtHeader(token);
  const decodedPayload = decodeJwtPayload(token);
  const issuerPresent = typeof decodedPayload['iss'] === 'string' && decodedPayload['iss'].trim().length > 0;
  const notBeforePresent = typeof decodedPayload['nbf'] === 'number';
  const audienceClaim = decodedPayload['aud'];
  const audiencePresent = typeof audienceClaim === 'string'
    ? audienceClaim.trim().length > 0
    : Array.isArray(audienceClaim) && audienceClaim.some((value) => typeof value === 'string' && value.trim().length > 0);
  const verifyOptions: VerifyOptions = {
    algorithms: [JWT_ALGORITHM],
    ignoreExpiration: false,
    ignoreNotBefore: false,
  };
  const candidates = resolveVerificationCandidates(config, tokenHeader.kid);
  let lastError: unknown = new Error('Token JWT invalido.');

  for (const candidate of candidates) {
    try {
      const payload = jwt.verify(token, candidate.secret, verifyOptions);

      if (issuerPresent && decodedPayload['iss'] !== claimConfig.issuer) {
        throw new JwtIssuerRejectedError();
      }

      const normalizedAudience = Array.isArray(audienceClaim) ? audienceClaim : [audienceClaim];
      if (
        audiencePresent &&
        !normalizedAudience.some((value) => typeof value === 'string' && value === claimConfig.audience)
      ) {
        throw new JwtAudienceRejectedError();
      }

      return {
        ...assertPayload(payload),
        keyId: candidate.keyId,
        tokenKeyId: tokenHeader.kid,
        legacyToken: candidate.legacyToken,
        issuerPresent,
        audiencePresent,
        notBeforePresent,
      };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}

export function createJwtSigner(input?: string | JwtKeyRotationConfig) {
  const resolvedConfig = resolveJwtKeyRotationConfig(input);
  const claimConfig = resolveJwtClaimConfig();

  return (payload: JwtPayload): string => {
    const signOptions: SignOptions = {
      algorithm: JWT_ALGORITHM,
      expiresIn: `${getAccessTokenTtlSeconds()}s`,
      issuer: claimConfig.issuer,
      audience: claimConfig.audience,
      notBefore: 0,
      header: {
        alg: JWT_ALGORITHM,
        kid: resolvedConfig.activeKid,
      },
    };

    return jwt.sign(
      {
        ...payload,
        tokenType: 'access',
      },
      resolvedConfig.keys[resolvedConfig.activeKid] as Secret,
      signOptions,
    );
  };
}

export function createJwtVerifier(input?: string | JwtKeyRotationConfig) {
  const resolvedConfig = resolveJwtKeyRotationConfig(input);
  const claimConfig = resolveJwtClaimConfig();

  return (token: string): VerifiedJwtPayload => verifyTokenAgainstCandidates(
    token,
    resolvedConfig,
    claimConfig,
    assertJwtPayload,
  );
}

export function createRefreshTokenSigner(input?: string | JwtKeyRotationConfig) {
  const resolvedConfig = resolveJwtKeyRotationConfig(input);
  const claimConfig = resolveJwtClaimConfig();

  return (payload: RefreshTokenPayload): string => {
    const signOptions: SignOptions = {
      algorithm: JWT_ALGORITHM,
      expiresIn: `${resolveRefreshTokenTtlSeconds()}s`,
      issuer: claimConfig.issuer,
      audience: claimConfig.audience,
      notBefore: 0,
      header: {
        alg: JWT_ALGORITHM,
        kid: resolvedConfig.activeKid,
      },
    };

    return jwt.sign(
      payload,
      resolvedConfig.keys[resolvedConfig.activeKid] as Secret,
      signOptions,
    );
  };
}

export function createRefreshTokenVerifier(input?: string | JwtKeyRotationConfig) {
  const resolvedConfig = resolveJwtKeyRotationConfig(input);
  const claimConfig = resolveJwtClaimConfig();

  return (token: string): VerifiedRefreshTokenPayload => verifyTokenAgainstCandidates(
    token,
    resolvedConfig,
    claimConfig,
    assertRefreshTokenPayload,
  );
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
