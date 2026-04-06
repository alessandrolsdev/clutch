import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { getRefreshTokenCookieMaxAgeSeconds } from '../../config/auth-session';
import {
  createJwtSigner,
  type JwtKeyRotationConfig,
  createRefreshTokenSigner,
  createRefreshTokenVerifier,
  type JwtPayload,
  type RefreshTokenPayload,
  type VerifiedRefreshTokenPayload,
} from '../../config/jwt';

export type RefreshSessionRecord = {
  sessionId: string;
  userId: string;
  username: string;
  tokenHash: string;
  expiresAt: number;
  status: 'active' | 'revoked';
  revokedAt: number | null;
  revokeReason: RefreshTokenRevokeReason | null;
};

/* eslint-disable no-unused-vars */
export type RefreshSessionStore = {
  get: (sessionId: string) => Promise<RefreshSessionRecord | null>;
  set: (sessionId: string, session: RefreshSessionRecord, ttlSeconds: number) => Promise<void>;
  delete: (sessionId: string) => Promise<void>;
};

export class RefreshTokenReuseError extends Error {
  readonly sessionId: string | null;

  constructor(sessionId: string | null = null) {
    super('Refresh token reutilizado ou invalido.');
    this.name = 'RefreshTokenReuseError';
    this.sessionId = sessionId;
  }
}

export class RefreshTokenInvalidError extends Error {
  constructor() {
    super('Refresh token invalido ou expirado.');
    this.name = 'RefreshTokenInvalidError';
  }
}

export class RefreshTokenRevokedError extends Error {
  readonly sessionId: string;
  readonly reason: RefreshTokenRevokeReason | null;

  constructor(sessionId: string, reason: RefreshTokenRevokeReason | null) {
    super('Sessao de refresh revogada.');
    this.name = 'RefreshTokenRevokedError';
    this.sessionId = sessionId;
    this.reason = reason;
  }
}

export type RefreshTokenRevokeReason =
  | 'logout'
  | 'refresh_token_reuse'
  | 'security';

export type RefreshSessionRevokeResult = {
  sessionId: string | null;
  status: 'revoked' | 'noop';
  reason: RefreshTokenRevokeReason | null;
};

function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function hashesMatch(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, 'utf8');
  const rightBuffer = Buffer.from(right, 'utf8');

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

function buildSessionRecord(
  payload: RefreshTokenPayload,
  token: string,
  expiresAt: number,
): RefreshSessionRecord {
  return {
    sessionId: payload.sessionId,
    userId: payload.id,
    username: payload.username,
    tokenHash: hashRefreshToken(token),
    expiresAt,
    status: 'active',
    revokedAt: null,
    revokeReason: null,
  };
}

function buildRevokedSessionRecord(
  session: RefreshSessionRecord,
  reason: RefreshTokenRevokeReason,
): RefreshSessionRecord {
  return {
    ...session,
    status: 'revoked',
    revokedAt: Date.now(),
    revokeReason: reason,
  };
}

function resolveSessionTtlSeconds(session: RefreshSessionRecord): number {
  return Math.max(1, Math.ceil((session.expiresAt - Date.now()) / 1000));
}

function assertRefreshSessionPayload(payload: RefreshTokenPayload, session: RefreshSessionRecord): void {
  if (payload.sessionId !== session.sessionId || payload.id !== session.userId || payload.username !== session.username) {
    throw new RefreshTokenInvalidError();
  }
}

export function createInMemoryRefreshSessionStore(): RefreshSessionStore {
  const sessions = new Map<string, { expiresAt: number; value: RefreshSessionRecord }>();

  return {
    async get(sessionId: string): Promise<RefreshSessionRecord | null> {
      const entry = sessions.get(sessionId);

      if (!entry) {
        return null;
      }

      if (entry.expiresAt <= Date.now()) {
        sessions.delete(sessionId);
        return null;
      }

      return entry.value;
    },

    async set(
      sessionId: string,
      session: RefreshSessionRecord,
      ttlSeconds: number,
    ): Promise<void> {
      sessions.set(sessionId, {
        expiresAt: Date.now() + (ttlSeconds * 1000),
        value: session,
      });
    },

    async delete(sessionId: string): Promise<void> {
      sessions.delete(sessionId);
    },
  };
}

export type IssueRefreshSessionInput = JwtPayload;

export type RefreshSessionResult = {
  accessToken: string;
  refreshToken: string;
};

export type RefreshTokenService = {
  issueSession(input: IssueRefreshSessionInput): Promise<RefreshSessionResult>;
  rotateSession(refreshToken: string): Promise<RefreshSessionResult>;
  revokeSession(
    refreshToken: string,
    reason?: RefreshTokenRevokeReason,
  ): Promise<RefreshSessionRevokeResult>;
};
/* eslint-enable no-unused-vars */

export type CreateRefreshTokenServiceOptions = {
  refreshSessionStore: RefreshSessionStore;
  jwtSecret?: string;
  jwtKeyRotationConfig?: JwtKeyRotationConfig;
};

export function createRefreshTokenService(
  options: CreateRefreshTokenServiceOptions,
): RefreshTokenService {
  const refreshSessionStore = options.refreshSessionStore;
  const jwtConfigInput = options.jwtKeyRotationConfig ?? options.jwtSecret;
  const signAccessToken = createJwtSigner(jwtConfigInput);
  const signRefreshToken = createRefreshTokenSigner(jwtConfigInput);
  const verifyRefreshToken = createRefreshTokenVerifier(jwtConfigInput);
  const refreshTokenTtlSeconds = getRefreshTokenCookieMaxAgeSeconds();
  const sessionLocks = new Map<string, { tail: Promise<void>; pending: number }>();

  async function withSessionLock<T>(sessionId: string, operation: () => Promise<T>): Promise<T> {
    const existingLock = sessionLocks.get(sessionId) ?? { tail: Promise.resolve(), pending: 0 };
    existingLock.pending += 1;
    const previousTail = existingLock.tail;
    let releaseCurrentLock!: () => void;
    existingLock.tail = new Promise<void>((resolve) => {
      releaseCurrentLock = resolve;
    });
    sessionLocks.set(sessionId, existingLock);

    await previousTail;

    try {
      return await operation();
    } finally {
      existingLock.pending -= 1;
      releaseCurrentLock();

      if (existingLock.pending === 0) {
        sessionLocks.delete(sessionId);
      }
    }
  }

  async function persistRefreshToken(refreshToken: string, payload: RefreshTokenPayload): Promise<void> {
    const expiresAt = Date.now() + (refreshTokenTtlSeconds * 1000);

    await refreshSessionStore.set(
      payload.sessionId,
      buildSessionRecord(payload, refreshToken, expiresAt),
      refreshTokenTtlSeconds,
    );
  }

  return {
    async issueSession(input: IssueRefreshSessionInput): Promise<RefreshSessionResult> {
      const accessToken = signAccessToken(input);
      const refreshPayload: RefreshTokenPayload = {
        ...input,
        tokenType: 'refresh',
        sessionId: randomUUID(),
        jti: randomUUID(),
      };
      const refreshToken = signRefreshToken(refreshPayload);

      await persistRefreshToken(refreshToken, refreshPayload);

      return {
        accessToken,
        refreshToken,
      };
    },

    async rotateSession(refreshToken: string): Promise<RefreshSessionResult> {
      let payload: VerifiedRefreshTokenPayload;

      try {
        payload = verifyRefreshToken(refreshToken);
      } catch {
        throw new RefreshTokenInvalidError();
      }

      return withSessionLock(payload.sessionId, async () => {
        const existingSession = await refreshSessionStore.get(payload.sessionId);

        if (!existingSession) {
          throw new RefreshTokenInvalidError();
        }

        if (existingSession.status === 'revoked') {
          throw new RefreshTokenRevokedError(
            existingSession.sessionId,
            existingSession.revokeReason,
          );
        }

        if (!hashesMatch(existingSession.tokenHash, hashRefreshToken(refreshToken))) {
          const revokedSession = buildRevokedSessionRecord(
            existingSession,
            'refresh_token_reuse',
          );

          await refreshSessionStore.set(
            payload.sessionId,
            revokedSession,
            resolveSessionTtlSeconds(existingSession),
          );

          throw new RefreshTokenReuseError(payload.sessionId);
        }

        assertRefreshSessionPayload(payload, existingSession);

        const nextPayload: RefreshTokenPayload = {
          id: payload.id,
          username: payload.username,
          tokenType: 'refresh',
          sessionId: payload.sessionId,
          jti: randomUUID(),
        };

        const nextAccessToken = signAccessToken({
          id: payload.id,
          username: payload.username,
        });
        const nextRefreshToken = signRefreshToken(nextPayload);

        await persistRefreshToken(nextRefreshToken, nextPayload);

        return {
          accessToken: nextAccessToken,
          refreshToken: nextRefreshToken,
        };
      });
    },

    async revokeSession(
      refreshToken: string,
      reason: RefreshTokenRevokeReason = 'logout',
    ): Promise<RefreshSessionRevokeResult> {
      let payload: VerifiedRefreshTokenPayload;

      try {
        payload = verifyRefreshToken(refreshToken);
      } catch {
        // Logout precisa ser idempotente e limpar o cookie mesmo com token ausente ou invalido.
        return {
          sessionId: null,
          status: 'noop',
          reason: null,
        };
      }

      return withSessionLock(payload.sessionId, async () => {
        const existingSession = await refreshSessionStore.get(payload.sessionId);

        if (!existingSession) {
          return {
            sessionId: payload.sessionId,
            status: 'noop',
            reason: null,
          };
        }

        if (existingSession.status === 'revoked') {
          return {
            sessionId: existingSession.sessionId,
            status: 'noop',
            reason: existingSession.revokeReason,
          };
        }

        const revokedSession = buildRevokedSessionRecord(existingSession, reason);
        await refreshSessionStore.set(
          payload.sessionId,
          revokedSession,
          resolveSessionTtlSeconds(existingSession),
        );

        return {
          sessionId: payload.sessionId,
          status: 'revoked',
          reason,
        };
      });
    },
  };
}
