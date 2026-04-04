import { describe, expect, it } from 'vitest';
import {
  createInMemoryRefreshSessionStore,
  createRefreshTokenService,
  RefreshTokenInvalidError,
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

  it('rejeita refresh token invalido ou expirado', async () => {
    const service = createRefreshTokenService({
      jwtSecret,
      refreshSessionStore: createInMemoryRefreshSessionStore(),
    });

    await expect(service.rotateSession('token-invalido')).rejects.toBeInstanceOf(RefreshTokenInvalidError);
  });

  it('revoga sessao sem falhar quando o token esta ausente ou invalido', async () => {
    const service = createRefreshTokenService({
      jwtSecret,
      refreshSessionStore: createInMemoryRefreshSessionStore(),
    });

    await expect(service.revokeSession('token-invalido')).resolves.toBeUndefined();
  });
});
