import { describe, expect, it, vi } from 'vitest';
import {
  createSocialAuthService,
  SocialAuthError,
  type SocialAuthProvider,
  type SocialAuthProviderClient,
} from '@/core/services/social-auth.service';
import { ConnectedAccountConflictError } from '@/core/services/connected-account.service';

const baseUser = {
  id: 'user-id-1',
  username: 'clutchplayer',
  email: 'player@clutch.gg',
  password_hash: 'hashed-password',
  isActive: true,
  createdAt: new Date('2026-04-28T00:00:00.000Z'),
  updatedAt: new Date('2026-04-28T00:00:00.000Z'),
};

function createProviderClient(
  provider: 'GOOGLE' | 'DISCORD',
  overrides: Partial<SocialAuthProviderClient> = {},
): SocialAuthProviderClient {
  return {
    provider,
    createAuthorizationUrl: vi.fn().mockReturnValue(`https://provider.test/${provider.toLowerCase()}/authorize`),
    exchangeCodeForIdentity: vi.fn().mockResolvedValue({
      provider,
      externalId: `${provider.toLowerCase()}-external-id`,
      email: provider === 'GOOGLE' ? 'player@clutch.gg' : null,
      emailVerified: provider === 'GOOGLE',
      displayName: provider === 'GOOGLE' ? 'Clutch Player' : 'clutchdiscord',
      username: provider === 'GOOGLE' ? 'clutchplayer' : 'clutchdiscord',
      avatarUrl: null,
      accessToken: `${provider.toLowerCase()}-access-token`,
      refreshToken: null,
      metadata: { provider },
    }),
    ...overrides,
  };
}

function createDependencies() {
  return {
    providerClients: {
      GOOGLE: createProviderClient('GOOGLE'),
      DISCORD: createProviderClient('DISCORD'),
    },
    users: {
      findById: vi.fn(),
      findByEmail: vi.fn(),
      findByUsername: vi.fn(),
      create: vi.fn(),
    },
    connectedAccounts: {
      findByProviderExternalId: vi.fn(),
      findByUserProvider: vi.fn(),
    },
    connectedAccountService: {
      connectExternalIdentity: vi.fn(),
    },
    hashPassword: vi.fn().mockResolvedValue('hashed-social-password'),
  };
}

async function issueState(
  service: ReturnType<typeof createSocialAuthService>,
  dependencies: ReturnType<typeof createDependencies>,
  provider: SocialAuthProvider,
): Promise<string> {
  await service.startLogin(provider.toLowerCase());
  const createAuthorizationUrl = vi.mocked(dependencies.providerClients[provider].createAuthorizationUrl);
  const lastCall = createAuthorizationUrl.mock.calls.at(-1);

  if (!lastCall) {
    throw new Error('Expected social auth state to be issued.');
  }

  return lastCall[0].state;
}

describe('social auth service', () => {
  it('inicia login social para provider suportado com state assinado', async () => {
    const dependencies = createDependencies();
    const service = createSocialAuthService(dependencies);

    const result = await service.startLogin('google');

    expect(result.provider).toBe('GOOGLE');
    expect(result.authorizationUrl).toBe('https://provider.test/google/authorize');
    expect(dependencies.providerClients.GOOGLE.createAuthorizationUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        state: expect.stringContaining('.'),
        nonce: expect.any(String),
      }),
    );
  });

  it('rejeita provider sem social login', async () => {
    const service = createSocialAuthService(createDependencies());

    await expect(service.startLogin('steam')).rejects.toMatchObject({
      statusCode: 400,
      reason: 'unsupported_provider',
    });
  });

  it('rejeita callback com state invalido', async () => {
    const service = createSocialAuthService(createDependencies());

    await expect(service.completeCallback({
      provider: 'google',
      code: 'oauth-code',
      state: 'invalid-state',
    })).rejects.toMatchObject({
      statusCode: 400,
      reason: 'invalid_state',
    });
  });

  it('emite login para o owner quando a identidade externa ja existe', async () => {
    const dependencies = createDependencies();
    const service = createSocialAuthService(dependencies);
    const state = await issueState(service, dependencies, 'DISCORD');
    dependencies.connectedAccounts.findByProviderExternalId.mockResolvedValue({
      id: 'identity-id-1',
      userId: 'user-id-1',
      provider: 'DISCORD',
      externalId: 'discord-external-id',
      status: 'CONNECTED',
    });
    dependencies.users.findById.mockResolvedValue(baseUser);

    const result = await service.completeCallback({
      provider: 'discord',
      code: 'oauth-code',
      state,
    });

    expect(result.user).toMatchObject({ id: 'user-id-1', username: 'clutchplayer' });
    expect(result.isNewUser).toBe(false);
    expect(dependencies.users.create).not.toHaveBeenCalled();
    expect(dependencies.connectedAccountService.connectExternalIdentity).not.toHaveBeenCalled();
  });

  it('cria usuario novo com Google usando sub como externalId e email verificado', async () => {
    const dependencies = createDependencies();
    const service = createSocialAuthService(dependencies);
    const state = await issueState(service, dependencies, 'GOOGLE');
    dependencies.connectedAccounts.findByProviderExternalId.mockResolvedValue(null);
    dependencies.connectedAccounts.findByUserProvider.mockResolvedValue(null);
    dependencies.users.findByEmail.mockResolvedValue(null);
    dependencies.users.findByUsername.mockResolvedValue(null);
    dependencies.users.create.mockResolvedValue({
      ...baseUser,
      id: 'new-user-id',
      username: 'clutchplayer',
      email: 'player@clutch.gg',
    });

    const result = await service.completeCallback({
      provider: 'google',
      code: 'oauth-code',
      state,
    });

    expect(dependencies.users.findByEmail).toHaveBeenCalledWith('player@clutch.gg');
    expect(dependencies.users.create).toHaveBeenCalledWith(
      expect.objectContaining({
        username: 'clutchplayer',
        email: 'player@clutch.gg',
        displayName: 'Clutch Player',
      }),
    );
    expect(dependencies.connectedAccountService.connectExternalIdentity).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'new-user-id',
        provider: 'GOOGLE',
        externalId: 'google-external-id',
        connectionType: 'SOCIAL_LOGIN',
        accessToken: 'google-access-token',
      }),
    );
    expect(result.isNewUser).toBe(true);
  });

  it('nao usa email nao verificado para tomar conta existente', async () => {
    const dependencies = createDependencies();
    const service = createSocialAuthService(dependencies);
    const state = await issueState(service, dependencies, 'GOOGLE');
    dependencies.providerClients.GOOGLE.exchangeCodeForIdentity = vi.fn().mockResolvedValue({
      provider: 'GOOGLE',
      externalId: 'google-external-id',
      email: 'player@clutch.gg',
      emailVerified: false,
      displayName: 'Clutch Player',
      username: null,
      avatarUrl: null,
      accessToken: 'google-access-token',
      refreshToken: null,
      metadata: {},
    });
    dependencies.connectedAccounts.findByProviderExternalId.mockResolvedValue(null);
    dependencies.connectedAccounts.findByUserProvider.mockResolvedValue(null);
    dependencies.users.findByUsername.mockResolvedValue(null);
    dependencies.users.create.mockResolvedValue({
      ...baseUser,
      id: 'new-user-id',
      username: 'clutch_player',
      email: 'social+google-google-external-id@users.clutch.local',
    });

    await service.completeCallback({
      provider: 'google',
      code: 'oauth-code',
      state,
    });

    expect(dependencies.users.findByEmail).not.toHaveBeenCalled();
    expect(dependencies.users.create).toHaveBeenCalledWith(
      expect.objectContaining({
        username: 'clutch_player',
        email: 'social+google-google-external-id@users.clutch.local',
      }),
    );
  });

  it('rejeita email verificado existente sem ownership externo previo', async () => {
    const dependencies = createDependencies();
    const service = createSocialAuthService(dependencies);
    const state = await issueState(service, dependencies, 'GOOGLE');
    dependencies.connectedAccounts.findByProviderExternalId.mockResolvedValue(null);
    dependencies.users.findByEmail.mockResolvedValue(baseUser);

    await expect(service.completeCallback({
      provider: 'google',
      code: 'oauth-code',
      state,
    })).rejects.toMatchObject({
      statusCode: 409,
      reason: 'identity_conflict',
    });

    expect(dependencies.users.create).not.toHaveBeenCalled();
    expect(dependencies.connectedAccountService.connectExternalIdentity).not.toHaveBeenCalled();
  });

  it('cria usuario social isolado quando email esta ausente', async () => {
    const dependencies = createDependencies();
    const service = createSocialAuthService(dependencies);
    const state = await issueState(service, dependencies, 'DISCORD');
    dependencies.providerClients.DISCORD.exchangeCodeForIdentity = vi.fn().mockResolvedValue({
      provider: 'DISCORD',
      externalId: 'discord-external-id',
      email: null,
      emailVerified: false,
      displayName: null,
      username: null,
      avatarUrl: null,
      accessToken: 'discord-access-token',
      refreshToken: null,
      metadata: {},
    });
    dependencies.connectedAccounts.findByProviderExternalId.mockResolvedValue(null);
    dependencies.connectedAccounts.findByUserProvider.mockResolvedValue(null);
    dependencies.users.findByUsername.mockResolvedValue(null);
    dependencies.users.create.mockResolvedValue({
      ...baseUser,
      id: 'new-user-id',
      username: 'player',
      email: 'social+discord-discord-external-id@users.clutch.local',
    });

    await service.completeCallback({
      provider: 'discord',
      code: 'oauth-code',
      state,
    });

    expect(dependencies.users.findByEmail).not.toHaveBeenCalled();
    expect(dependencies.users.create).toHaveBeenCalledWith(
      expect.objectContaining({
        username: 'player',
        email: 'social+discord-discord-external-id@users.clutch.local',
      }),
    );
  });

  it('rejeita reutilizacao de state social', async () => {
    const dependencies = createDependencies();
    const service = createSocialAuthService(dependencies);
    const state = await issueState(service, dependencies, 'DISCORD');
    dependencies.connectedAccounts.findByProviderExternalId.mockResolvedValue({
      id: 'identity-id-1',
      userId: 'user-id-1',
      provider: 'DISCORD',
      externalId: 'discord-external-id',
      status: 'CONNECTED',
    });
    dependencies.users.findById.mockResolvedValue(baseUser);

    await service.completeCallback({
      provider: 'discord',
      code: 'oauth-code',
      state,
    });

    await expect(service.completeCallback({
      provider: 'discord',
      code: 'oauth-code',
      state,
    })).rejects.toMatchObject({
      statusCode: 400,
      reason: 'invalid_state',
    });
  });

  it('mapeia conflito de ownership externo para erro de dominio', async () => {
    const dependencies = createDependencies();
    const service = createSocialAuthService(dependencies);
    const state = await issueState(service, dependencies, 'GOOGLE');
    dependencies.connectedAccounts.findByProviderExternalId.mockResolvedValue(null);
    dependencies.connectedAccounts.findByUserProvider.mockResolvedValue(null);
    dependencies.users.findByEmail.mockResolvedValue(null);
    dependencies.users.findByUsername.mockResolvedValue(null);
    dependencies.users.create.mockResolvedValue({
      ...baseUser,
      id: 'new-user-id',
    });
    dependencies.connectedAccountService.connectExternalIdentity.mockRejectedValue(
      new ConnectedAccountConflictError('GOOGLE', 'google-external-id', 'other-user-id'),
    );

    await expect(service.completeCallback({
      provider: 'google',
      code: 'oauth-code',
      state,
    })).rejects.toBeInstanceOf(SocialAuthError);
  });
});
