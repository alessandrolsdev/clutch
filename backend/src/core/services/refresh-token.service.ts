import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { getRefreshTokenCookieMaxAgeSeconds } from '../../config/auth-session';
import {
  createJwtSigner,
  createRefreshTokenSigner,
  createRefreshTokenVerifier,
  type JwtPayload,
  type RefreshTokenPayload,
} from '../../config/jwt';

export type RefreshSessionRecord = {
  sessionId: string;
  userId: string;
  username: string;
  tokenHash: string;
};

/* eslint-disable no-unused-vars */
export type RefreshSessionStore = {
  get: (sessionId: string) => Promise<RefreshSessionRecord | null>;
  set: (sessionId: string, session: RefreshSessionRecord, ttlSeconds: number) => Promise<void>;
  delete: (sessionId: string) => Promise<void>;
};

export class RefreshTokenReuseError extends Error {
  constructor() {
    super('Refresh token reutilizado ou invalido.');
    this.name = 'RefreshTokenReuseError';
  }
}

export class RefreshTokenInvalidError extends Error {
  constructor() {
    super('Refresh token invalido ou expirado.');
    this.name = 'RefreshTokenInvalidError';
  }
}

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
): RefreshSessionRecord {
  return {
    sessionId: payload.sessionId,
    userId: payload.id,
    username: payload.username,
    tokenHash: hashRefreshToken(token),
  };
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
  revokeSession(refreshToken: string): Promise<void>;
};
/* eslint-enable no-unused-vars */

export type CreateRefreshTokenServiceOptions = {
  refreshSessionStore: RefreshSessionStore;
  jwtSecret?: string;
};

export function createRefreshTokenService(
  options: CreateRefreshTokenServiceOptions,
): RefreshTokenService {
  const refreshSessionStore = options.refreshSessionStore;
  const signAccessToken = createJwtSigner(options.jwtSecret);
  const signRefreshToken = createRefreshTokenSigner(options.jwtSecret);
  const verifyRefreshToken = createRefreshTokenVerifier(options.jwtSecret);
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
    await refreshSessionStore.set(
      payload.sessionId,
      buildSessionRecord(payload, refreshToken),
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
      let payload: RefreshTokenPayload;

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

        if (!hashesMatch(existingSession.tokenHash, hashRefreshToken(refreshToken))) {
          await refreshSessionStore.delete(payload.sessionId);
          throw new RefreshTokenReuseError();
        }

        assertRefreshSessionPayload(payload, existingSession);

        const nextPayload: RefreshTokenPayload = {
          ...payload,
          tokenType: 'refresh',
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

    async revokeSession(refreshToken: string): Promise<void> {
      try {
        const payload = verifyRefreshToken(refreshToken);
        await withSessionLock(payload.sessionId, async () => {
          await refreshSessionStore.delete(payload.sessionId);
        });
      } catch {
        // Logout precisa ser idempotente e limpar o cookie mesmo com token ausente ou invalido.
      }
    },
  };
}
