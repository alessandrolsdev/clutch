import { describe, expect, it } from 'vitest';
import {
  createInMemoryRefreshSessionStore,
  createRefreshTokenService,
  type RefreshSessionRecord,
  type RefreshSessionStore,
  RefreshTokenInvalidError,
  RefreshTokenRevokedError,
  RefreshTokenReuseError,
} from '@/core/services/refresh-token.service';

describe('refresh token service', () => {
  const jwtSecret = 'refresh-token-test-secret';

  it('emite access token e refresh token para uma nova sessao', async () => {
    const service = createRefreshTokenService({
      jwtSecret,
      refreshSessionStore: createInMemoryRefreshSessionStore(),
    });

    const session = await service.issueSession({
      id: 'user-1',
      username: 'clutchplayer',
    });

    expect(session.accessToken).toBeTypeOf('string');
    expect(session.refreshToken).toBeTypeOf('string');
    expect(session.accessToken).not.toBe(session.refreshToken);
  });

  it('rotaciona o refresh token e invalida o anterior por reuse', async () => {
    const service = createRefreshTokenService({
      jwtSecret,
      refreshSessionStore: createInMemoryRefreshSessionStore(),
    });

    const initialSession = await service.issueSession({
      id: 'user-1',
      username: 'clutchplayer',
    });

    const rotatedSession = await service.rotateSession(initialSession.refreshToken);

    expect(rotatedSession.refreshToken).not.toBe(initialSession.refreshToken);
    await expect(service.rotateSession(initialSession.refreshToken)).rejects.toBeInstanceOf(RefreshTokenReuseError);
  });

  it('serializa refresh concorrente da mesma sessao sem gerar duas rotacoes validas', async () => {
    const service = createRefreshTokenService({
      jwtSecret,
      refreshSessionStore: createInMemoryRefreshSessionStore(),
    });

    const initialSession = await service.issueSession({
      id: 'user-1',
      username: 'clutchplayer',
    });

    const results = await Promise.allSettled([
      service.rotateSession(initialSession.refreshToken),
      service.rotateSession(initialSession.refreshToken),
    ]);

    const fulfilledResults = results.filter(
      (result): result is PromiseFulfilledResult<Awaited<ReturnType<typeof service.rotateSession>>> =>
        result.status === 'fulfilled',
    );
    const rejectedResults = results.filter(
      (result): result is PromiseRejectedResult =>
        result.status === 'rejected',
    );

    expect(fulfilledResults).toHaveLength(1);
    expect(rejectedResults).toHaveLength(1);
    expect(rejectedResults[0]?.reason).toBeInstanceOf(RefreshTokenReuseError);
  });

  it('rejeita refresh token invalido ou expirado', async () => {
    const service = createRefreshTokenService({
      jwtSecret,
      refreshSessionStore: createInMemoryRefreshSessionStore(),
    });

    await expect(service.rotateSession('token-invalido')).rejects.toBeInstanceOf(RefreshTokenInvalidError);
  });

  it('revoga a sessao atual e rejeita refresh posterior como sessao revogada', async () => {
    const service = createRefreshTokenService({
      jwtSecret,
      refreshSessionStore: createInMemoryRefreshSessionStore(),
    });

    const session = await service.issueSession({
      id: 'user-1',
      username: 'clutchplayer',
    });

    const revokeResult = await service.revokeSession(session.refreshToken, 'logout');

    expect(revokeResult).toMatchObject({
      status: 'revoked',
      reason: 'logout',
    });
    await expect(service.rotateSession(session.refreshToken)).rejects.toBeInstanceOf(RefreshTokenRevokedError);
    await expect(service.rotateSession(session.refreshToken)).rejects.toBeInstanceOf(RefreshTokenRevokedError);
  });

  it('preserva o ttl residual ao marcar a sessao como revogada', async () => {
    const capturedTtls: number[] = [];
    const sessions = new Map<string, RefreshSessionRecord>();
    const refreshSessionStore: RefreshSessionStore = {
      async get(sessionId: string) {
        return sessions.get(sessionId) ?? null;
      },
      async set(sessionId: string, session: RefreshSessionRecord, ttlSeconds: number) {
        capturedTtls.push(ttlSeconds);
        sessions.set(sessionId, session);
      },
      async delete(sessionId: string) {
        sessions.delete(sessionId);
      },
    };

    const service = createRefreshTokenService({
      jwtSecret,
      refreshSessionStore,
    });

    const beforeIssue = Date.now();
    const session = await service.issueSession({
      id: 'user-1',
      username: 'clutchplayer',
    });
    const afterIssue = Date.now();

    const storedSession = [...sessions.values()][0];

    expect(storedSession).toBeDefined();

    const issueTtl = capturedTtls[0];
    if (typeof issueTtl !== 'number') {
      throw new Error('TTL inicial da sessao nao foi capturado.');
    }
    expect(issueTtl).toBeGreaterThan(60 * 60 * 24 * 6);

    await service.revokeSession(session.refreshToken, 'logout');

    const revokeTtl = capturedTtls[1];
    if (typeof revokeTtl !== 'number') {
      throw new Error('TTL residual da sessao revogada nao foi capturado.');
    }
    expect(revokeTtl).toBeLessThanOrEqual(issueTtl);
    expect(revokeTtl).toBeGreaterThanOrEqual(issueTtl - Math.ceil((afterIssue - beforeIssue) / 1000) - 2);
    expect([...sessions.values()][0]).toMatchObject({
      status: 'revoked',
      revokeReason: 'logout',
    });
  });

  it('mantem o bloqueio de reuse apos rotacao', async () => {
    const service = createRefreshTokenService({
      jwtSecret,
      refreshSessionStore: createInMemoryRefreshSessionStore(),
    });

    const initialSession = await service.issueSession({
      id: 'user-1',
      username: 'clutchplayer',
    });

    await service.rotateSession(initialSession.refreshToken);
    await expect(service.rotateSession(initialSession.refreshToken)).rejects.toBeInstanceOf(RefreshTokenReuseError);
  });

  it('revoga sessao sem falhar quando o token esta ausente ou invalido', async () => {
    const service = createRefreshTokenService({
      jwtSecret,
      refreshSessionStore: createInMemoryRefreshSessionStore(),
    });

    await expect(service.revokeSession('token-invalido')).resolves.toMatchObject({
      sessionId: null,
      status: 'noop',
      reason: null,
    });
  });
});
