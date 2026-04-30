import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Platform, User } from '@prisma/client';
import {
  AccountConnectionError,
  createAccountConnectionService,
  type PublicConnectedAccount,
} from '@/core/services/account-connection.service';
import { ConnectedAccountConflictError } from '@/core/services/connected-account.service';
import type { ConnectedAccountRecord } from '@/core/repositories/connected-account.repository';
import type {
  SocialAuthProvider,
  SocialAuthProviderClient,
} from '@/core/services/social-auth.service';

const baseUser: User = {
  id: 'user-id-1',
  username: 'clutchplayer',
  email: 'clutchplayer@users.clutch.local',
  password_hash: 'hashed-password',
  isActive: true,
  createdAt: new Date('2026-04-28T00:00:00.000Z'),
  updatedAt: new Date('2026-04-28T00:00:00.000Z'),
};

function createProviderClient(
  provider: SocialAuthProvider,
  externalId = `${provider.toLowerCase()}-external-id`,
): SocialAuthProviderClient {
  return {
    provider,
    createAuthorizationUrl: vi.fn().mockReturnValue(`https://provider.test/${provider.toLowerCase()}/authorize`),
    exchangeCodeForIdentity: vi.fn().mockResolvedValue({
      provider,
      externalId,
      email: provider === 'GOOGLE' ? 'player@clutch.gg' : null,
      emailVerified: provider === 'GOOGLE',
      displayName: provider === 'GOOGLE' ? 'Clutch Player' : 'clutchdiscord',
      username: provider === 'GOOGLE' ? 'clutchplayer' : 'clutchdiscord',
      avatarUrl: null,
      accessToken: `${provider.toLowerCase()}-access-token`,
      refreshToken: `${provider.toLowerCase()}-refresh-token`,
      metadata: { provider },
    }),
  };
}

function createAccount(overrides: Partial<ConnectedAccountRecord> = {}): ConnectedAccountRecord {
  return {
    id: 'account-id-1',
    userId: 'user-id-1',
    provider: 'GOOGLE',
    externalId: 'google-external-id',
    connectionType: 'SOCIAL_LOGIN',
    status: 'CONNECTED',
    dataSource: 'OFFICIAL',
    metadata: null,
    publicProfileVisible: false,
    createdAt: new Date('2026-04-28T00:00:00.000Z'),
    updatedAt: new Date('2026-04-28T00:00:00.000Z'),
    lastSyncAt: null,
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
      findById: vi.fn().mockResolvedValue(baseUser),
    },
    repository: {
      listByUser: vi.fn().mockResolvedValue([]),
      findByProviderExternalId: vi.fn().mockResolvedValue(null),
      findByUserProvider: vi.fn().mockResolvedValue(null),
      deleteByUserProvider: vi.fn().mockResolvedValue(null),
      updateVisibility: vi.fn().mockResolvedValue(null),
    },
    connectedAccountService: {
      connectExternalIdentity: vi.fn().mockResolvedValue(createAccount()),
    },
  };
}

async function issueState(
  service: ReturnType<typeof createAccountConnectionService>,
  dependencies: ReturnType<typeof createDependencies>,
  provider: SocialAuthProvider,
  mode: 'link' | 'reauth' = 'link',
): Promise<string> {
  if (mode === 'reauth') {
    dependencies.repository.findByUserProvider.mockResolvedValueOnce(createAccount({
      provider,
      externalId: `${provider.toLowerCase()}-external-id`,
      status: 'NEEDS_REAUTH',
    }));
    await service.startReauth({ userId: 'user-id-1', provider: provider.toLowerCase() });
  } else {
    await service.startLink({ userId: 'user-id-1', provider: provider.toLowerCase() });
  }

  const createAuthorizationUrl = vi.mocked(dependencies.providerClients[provider].createAuthorizationUrl);
  const lastCall = createAuthorizationUrl.mock.calls.at(-1);

  if (!lastCall) {
    throw new Error('Expected account connection state to be issued.');
  }

  return lastCall[0].state;
}

describe('account connection service', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('lista contas conectadas sem expor tokens', async () => {
    const dependencies = createDependencies();
    dependencies.repository.listByUser.mockResolvedValue([
      createAccount({
        provider: 'DISCORD',
        externalId: 'discord-user-id',
        connectionType: 'CONNECTED_ACCOUNT',
        status: 'NEEDS_REAUTH',
      }),
    ]);
    const service = createAccountConnectionService(dependencies);

    const result = await service.listConnectedAccounts('user-id-1');

    expect(result.accounts).toHaveLength(1);
    expect(result.accounts[0]).toMatchObject<Partial<PublicConnectedAccount>>({
      provider: 'DISCORD',
      externalId: 'discord-user-id',
      connectionType: 'CONNECTED_ACCOUNT',
      publicProfileVisible: false,
      needsReauth: true,
      connected: false,
    });
    expect(result.accounts[0]).not.toHaveProperty('accessToken');
    expect(result.accounts[0]).not.toHaveProperty('refreshToken');
    expect(result.providers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          provider: 'GOOGLE',
          displayName: 'Google',
          capabilities: expect.arrayContaining(['OAUTH_CONNECT']),
        }),
        expect.objectContaining({
          provider: 'EPIC',
          status: 'EXPERIMENTAL',
        }),
        expect.objectContaining({
          provider: 'MYANIMELIST',
          status: 'UNAVAILABLE',
          capabilities: ['CONNECTED_ACCOUNT'],
        }),
      ]),
    );
    expect(result.providers).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          provider: 'ANILIST',
        }),
      ]),
    );
  });

  it('marca ultimo login social como nao removivel quando usuario nao tem senha local viavel', async () => {
    const dependencies = createDependencies();
    dependencies.repository.listByUser.mockResolvedValue([createAccount()]);
    const service = createAccountConnectionService(dependencies);

    const result = await service.listConnectedAccounts('user-id-1');

    expect(result.accounts[0]).toMatchObject({
      provider: 'GOOGLE',
      connectionType: 'SOCIAL_LOGIN',
      canUnlink: false,
    });
  });

  it('inicia linking para provider OAuth suportado com state assinado', async () => {
    const dependencies = createDependencies();
    const service = createAccountConnectionService(dependencies);

    const result = await service.startLink({ userId: 'user-id-1', provider: 'google' });

    expect(result).toMatchObject({
      provider: 'GOOGLE',
      authorizationUrl: 'https://provider.test/google/authorize',
    });
    expect(dependencies.providerClients.GOOGLE.createAuthorizationUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        state: expect.stringContaining('.'),
        nonce: expect.any(String),
      }),
    );
  });

  it('usa callback de account linking quando deriva redirectUri do login social', async () => {
    const previousRedirectUri = process.env['GOOGLE_REDIRECT_URI'];

    try {
      process.env['GOOGLE_REDIRECT_URI'] = 'http://localhost/api/auth/social/google/callback';
      const dependencies = createDependencies();
      const service = createAccountConnectionService(dependencies);

      await service.startLink({ userId: 'user-id-1', provider: 'google' });

      expect(dependencies.providerClients.GOOGLE.createAuthorizationUrl).toHaveBeenCalledWith(
        expect.objectContaining({
          redirectUri: 'http://localhost/api/auth/accounts/google/link/callback',
        }),
      );
    } finally {
      if (typeof previousRedirectUri === 'undefined') {
        delete process.env['GOOGLE_REDIRECT_URI'];
      } else {
        process.env['GOOGLE_REDIRECT_URI'] = previousRedirectUri;
      }
    }
  });

  it('usa redirectUri explicito de reauth quando configurado para o fluxo', async () => {
    const previousRedirectUri = process.env['DISCORD_ACCOUNT_REAUTH_REDIRECT_URI'];

    try {
      process.env['DISCORD_ACCOUNT_REAUTH_REDIRECT_URI'] = 'http://localhost/api/auth/accounts/discord/reauth/callback';
      const dependencies = createDependencies();
      dependencies.repository.findByUserProvider.mockResolvedValue(createAccount({
        provider: 'DISCORD',
        status: 'NEEDS_REAUTH',
      }));
      const service = createAccountConnectionService(dependencies);

      await service.startReauth({ userId: 'user-id-1', provider: 'discord' });

      expect(dependencies.providerClients.DISCORD.createAuthorizationUrl).toHaveBeenCalledWith(
        expect.objectContaining({
          redirectUri: 'http://localhost/api/auth/accounts/discord/reauth/callback',
        }),
      );
    } finally {
      if (typeof previousRedirectUri === 'undefined') {
        delete process.env['DISCORD_ACCOUNT_REAUTH_REDIRECT_URI'];
      } else {
        process.env['DISCORD_ACCOUNT_REAUTH_REDIRECT_URI'] = previousRedirectUri;
      }
    }
  });

  it('rejeita linking para provider sem capability OAuth connect', async () => {
    const service = createAccountConnectionService(createDependencies());

    await expect(service.startLink({
      userId: 'user-id-1',
      provider: 'steam',
    })).rejects.toMatchObject({
      statusCode: 400,
      reason: 'unsupported_provider',
    });

    await expect(service.startLink({
      userId: 'user-id-1',
      provider: 'myanimelist',
    })).rejects.toMatchObject({
      statusCode: 400,
      reason: 'unsupported_provider',
    });
  });

  it('conecta identidade externa ao usuario autenticado sem criar conta CLUTCH', async () => {
    const dependencies = createDependencies();
    const service = createAccountConnectionService(dependencies);
    const state = await issueState(service, dependencies, 'GOOGLE');

    const result = await service.completeLink({
      provider: 'google',
      code: 'oauth-code',
      state,
    });

    expect(result).toMatchObject({
      provider: 'GOOGLE',
      externalId: 'google-external-id',
      status: 'CONNECTED',
      connectionType: 'SOCIAL_LOGIN',
    });
    expect(dependencies.connectedAccountService.connectExternalIdentity).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-id-1',
        provider: 'GOOGLE',
        externalId: 'google-external-id',
        connectionType: 'SOCIAL_LOGIN',
        accessToken: 'google-access-token',
        refreshToken: 'google-refresh-token',
      }),
    );
  });

  it('bloqueia linking quando identidade externa pertence a outro usuario', async () => {
    const dependencies = createDependencies();
    const service = createAccountConnectionService(dependencies);
    const state = await issueState(service, dependencies, 'DISCORD');
    dependencies.repository.findByProviderExternalId.mockResolvedValueOnce(createAccount({
      provider: 'DISCORD',
      externalId: 'discord-external-id',
      userId: 'other-user-id',
    }));

    await expect(service.completeLink({
      provider: 'discord',
      code: 'oauth-code',
      state,
    })).rejects.toMatchObject({
      statusCode: 409,
      reason: 'identity_conflict',
    });
    expect(dependencies.connectedAccountService.connectExternalIdentity).not.toHaveBeenCalled();
  });

  it('rejeita callback de linking com state expirado antes de trocar token', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-29T12:00:00.000Z'));
    const dependencies = createDependencies();
    const service = createAccountConnectionService(dependencies);
    const state = await issueState(service, dependencies, 'GOOGLE');

    vi.setSystemTime(new Date('2026-04-29T12:11:00.000Z'));

    await expect(service.completeLink({
      provider: 'google',
      code: 'oauth-code',
      state,
    })).rejects.toMatchObject({
      statusCode: 400,
      reason: 'invalid_state',
      clientMessage: 'Callback de conexão inválido ou expirado.',
    });
    expect(dependencies.providerClients.GOOGLE.exchangeCodeForIdentity).not.toHaveBeenCalled();
  });

  it('mapeia corrida de ownership externo para erro de dominio', async () => {
    const dependencies = createDependencies();
    const service = createAccountConnectionService(dependencies);
    const state = await issueState(service, dependencies, 'DISCORD');
    dependencies.connectedAccountService.connectExternalIdentity.mockRejectedValueOnce(
      new ConnectedAccountConflictError('DISCORD', 'discord-external-id', 'other-user-id'),
    );

    await expect(service.completeLink({
      provider: 'discord',
      code: 'oauth-code',
      state,
    })).rejects.toMatchObject({
      statusCode: 409,
      reason: 'identity_conflict',
    });
  });

  it('desconecta conta externa quando nao remove ultimo metodo de login', async () => {
    const dependencies = createDependencies();
    dependencies.repository.findByUserProvider.mockResolvedValue(createAccount({
      provider: 'STEAM',
      connectionType: 'CONNECTED_ACCOUNT',
    }));
    dependencies.repository.deleteByUserProvider.mockResolvedValue(createAccount({
      provider: 'STEAM',
      connectionType: 'CONNECTED_ACCOUNT',
    }));
    const service = createAccountConnectionService(dependencies);

    const result = await service.unlink({ userId: 'user-id-1', provider: 'steam' });

    expect(result).toMatchObject({
      provider: 'STEAM',
      message: 'Steam desconectado com sucesso.',
    });
    expect(dependencies.repository.deleteByUserProvider).toHaveBeenCalledWith('user-id-1', 'STEAM');
  });

  it('bloqueia unlink do ultimo login social quando usuario nao tem senha local viavel', async () => {
    const dependencies = createDependencies();
    dependencies.repository.findByUserProvider.mockResolvedValue(createAccount());
    dependencies.repository.listByUser.mockResolvedValue([createAccount()]);
    const service = createAccountConnectionService(dependencies);

    await expect(service.unlink({
      userId: 'user-id-1',
      provider: 'google',
    })).rejects.toMatchObject({
      statusCode: 409,
      reason: 'unsafe_unlink',
    });
    expect(dependencies.repository.deleteByUserProvider).not.toHaveBeenCalled();
  });

  it('permite unlink do login social quando usuario tem email local viavel', async () => {
    const dependencies = createDependencies();
    dependencies.users.findById.mockResolvedValue({
      ...baseUser,
      email: 'player@clutch.gg',
    });
    dependencies.repository.findByUserProvider.mockResolvedValue(createAccount());
    dependencies.repository.deleteByUserProvider.mockResolvedValue(createAccount());
    const service = createAccountConnectionService(dependencies);

    await expect(service.unlink({
      userId: 'user-id-1',
      provider: 'google',
    })).resolves.toMatchObject({ provider: 'GOOGLE' });
  });

  it('retorna erro coerente ao remover conta inexistente', async () => {
    const service = createAccountConnectionService(createDependencies());

    await expect(service.unlink({
      userId: 'user-id-1',
      provider: 'discord',
    })).rejects.toMatchObject({
      statusCode: 404,
      reason: 'not_connected',
    });
  });

  it('atualiza visibilidade publica da propria conta ativa oficial', async () => {
    const dependencies = createDependencies();
    const account = createAccount({
      provider: 'STEAM',
      connectionType: 'CONNECTED_ACCOUNT',
      publicProfileVisible: false,
    });
    dependencies.repository.findByUserProvider.mockResolvedValue(account);
    dependencies.repository.updateVisibility.mockResolvedValue({
      ...account,
      publicProfileVisible: true,
    });
    dependencies.repository.listByUser.mockResolvedValue([{
      ...account,
      publicProfileVisible: true,
    }]);
    const service = createAccountConnectionService(dependencies);

    const result = await service.updateVisibility({
      userId: 'user-id-1',
      provider: 'steam',
      publicProfileVisible: true,
    });

    expect(result).toMatchObject({
      provider: 'STEAM',
      publicProfileVisible: true,
      connected: true,
    });
    expect(dependencies.repository.updateVisibility).toHaveBeenCalledWith({
      userId: 'user-id-1',
      provider: 'STEAM',
      publicProfileVisible: true,
    });
  });

  it('remove conta apenas pelo userId autenticado e provider solicitado', async () => {
    const dependencies = createDependencies();
    dependencies.repository.findByUserProvider.mockResolvedValue(createAccount({
      provider: 'DISCORD',
      userId: 'user-id-1',
      connectionType: 'CONNECTED_ACCOUNT',
    }));
    dependencies.repository.deleteByUserProvider.mockResolvedValue(createAccount({
      provider: 'DISCORD',
      userId: 'user-id-1',
      connectionType: 'CONNECTED_ACCOUNT',
    }));
    const service = createAccountConnectionService(dependencies);

    await service.unlink({ userId: 'user-id-1', provider: 'discord' });

    expect(dependencies.repository.findByUserProvider).toHaveBeenCalledWith('user-id-1', 'DISCORD');
    expect(dependencies.repository.deleteByUserProvider).toHaveBeenCalledWith('user-id-1', 'DISCORD');
  });

  it('bloqueia visibilidade publica para conta que precisa reconectar', async () => {
    const dependencies = createDependencies();
    dependencies.repository.findByUserProvider.mockResolvedValue(createAccount({
      status: 'NEEDS_REAUTH',
    }));
    const service = createAccountConnectionService(dependencies);

    await expect(service.updateVisibility({
      userId: 'user-id-1',
      provider: 'google',
      publicProfileVisible: true,
    })).rejects.toMatchObject({
      statusCode: 409,
      reason: 'visibility_not_allowed',
    });
    expect(dependencies.repository.updateVisibility).not.toHaveBeenCalled();
  });

  it('bloqueia visibilidade publica para conta experimental ou nao oficial', async () => {
    const dependencies = createDependencies();
    dependencies.repository.findByUserProvider.mockResolvedValue(createAccount({
      provider: 'EPIC',
      dataSource: 'EXPERIMENTAL',
    }));
    const service = createAccountConnectionService(dependencies);

    await expect(service.updateVisibility({
      userId: 'user-id-1',
      provider: 'epic',
      publicProfileVisible: true,
    })).rejects.toMatchObject({
      statusCode: 409,
      reason: 'visibility_not_allowed',
    });
    expect(dependencies.repository.updateVisibility).not.toHaveBeenCalled();
  });

  it('permite tornar privada uma conta que nao esta ativa', async () => {
    const dependencies = createDependencies();
    const account = createAccount({
      status: 'NEEDS_REAUTH',
      publicProfileVisible: true,
    });
    dependencies.repository.findByUserProvider.mockResolvedValue(account);
    dependencies.repository.updateVisibility.mockResolvedValue({
      ...account,
      publicProfileVisible: false,
    });
    const service = createAccountConnectionService(dependencies);

    const result = await service.updateVisibility({
      userId: 'user-id-1',
      provider: 'google',
      publicProfileVisible: false,
    });

    expect(result.publicProfileVisible).toBe(false);
  });

  it('inicia reauth apenas para conta em NEEDS_REAUTH', async () => {
    const dependencies = createDependencies();
    dependencies.repository.findByUserProvider.mockResolvedValue(createAccount({
      provider: 'DISCORD',
      status: 'NEEDS_REAUTH',
    }));
    const service = createAccountConnectionService(dependencies);

    const result = await service.startReauth({ userId: 'user-id-1', provider: 'discord' });

    expect(result.provider).toBe('DISCORD');
    expect(result.authorizationUrl).toBe('https://provider.test/discord/authorize');
  });

  it('bloqueia reauth para conta inexistente', async () => {
    const service = createAccountConnectionService(createDependencies());

    await expect(service.startReauth({
      userId: 'user-id-1',
      provider: 'discord',
    })).rejects.toMatchObject({
      statusCode: 404,
      reason: 'not_connected',
    });
  });

  it('rejeita reauth para provider sem OAuth connect', async () => {
    const service = createAccountConnectionService(createDependencies());

    await expect(service.startReauth({
      userId: 'user-id-1',
      provider: 'epic',
    })).rejects.toMatchObject({
      statusCode: 400,
      reason: 'unsupported_provider',
    });
  });

  it('reconecta mantendo o mesmo externalId e ownership', async () => {
    const dependencies = createDependencies();
    const service = createAccountConnectionService(dependencies);
    const state = await issueState(service, dependencies, 'DISCORD', 'reauth');
    dependencies.repository.findByUserProvider.mockResolvedValueOnce(createAccount({
      provider: 'DISCORD',
      externalId: 'discord-external-id',
      connectionType: 'CONNECTED_ACCOUNT',
      status: 'NEEDS_REAUTH',
    }));

    const result = await service.completeReauth({
      provider: 'discord',
      code: 'oauth-code',
      state,
    });

    expect(result).toMatchObject({
      provider: 'DISCORD',
      externalId: 'discord-external-id',
      status: 'CONNECTED',
      connectionType: 'CONNECTED_ACCOUNT',
    });
    expect(dependencies.connectedAccountService.connectExternalIdentity).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-id-1',
        provider: 'DISCORD',
        externalId: 'discord-external-id',
        connectionType: 'CONNECTED_ACCOUNT',
        status: 'CONNECTED',
      }),
    );
  });

  it('bloqueia reauth quando provider retorna externalId diferente', async () => {
    const dependencies = createDependencies();
    dependencies.providerClients.DISCORD = createProviderClient('DISCORD', 'discord-other-id');
    const service = createAccountConnectionService(dependencies);
    const state = await issueState(service, dependencies, 'DISCORD', 'reauth');

    await expect(service.completeReauth({
      provider: 'discord',
      code: 'oauth-code',
      state,
    })).rejects.toMatchObject({
      statusCode: 409,
      reason: 'identity_conflict',
    });
  });

  it('bloqueia reauth quando a conta original mudou depois do state emitido', async () => {
    const dependencies = createDependencies();
    const service = createAccountConnectionService(dependencies);
    const state = await issueState(service, dependencies, 'DISCORD', 'reauth');
    dependencies.repository.findByUserProvider.mockResolvedValueOnce(createAccount({
      provider: 'DISCORD',
      externalId: 'discord-other-id',
      status: 'NEEDS_REAUTH',
    }));

    await expect(service.completeReauth({
      provider: 'discord',
      code: 'oauth-code',
      state,
    })).rejects.toMatchObject({
      statusCode: 409,
      reason: 'identity_conflict',
      clientMessage: 'A conta original mudou desde o início da reconexão.',
    });
  });

  it('bloqueia reauth quando a conta deixou de exigir reconexao depois do state emitido', async () => {
    const dependencies = createDependencies();
    const service = createAccountConnectionService(dependencies);
    const state = await issueState(service, dependencies, 'DISCORD', 'reauth');
    dependencies.repository.findByUserProvider.mockResolvedValueOnce(createAccount({
      provider: 'DISCORD',
      externalId: 'discord-external-id',
      status: 'CONNECTED',
    }));

    await expect(service.completeReauth({
      provider: 'discord',
      code: 'oauth-code',
      state,
    })).rejects.toMatchObject({
      statusCode: 400,
      reason: 'invalid_request',
      clientMessage: 'Esta conta não precisa de reconexão.',
    });
    expect(dependencies.connectedAccountService.connectExternalIdentity).not.toHaveBeenCalled();
  });

  it('falha callback com state reutilizado', async () => {
    const dependencies = createDependencies();
    const service = createAccountConnectionService(dependencies);
    const state = await issueState(service, dependencies, 'GOOGLE');

    await service.completeLink({
      provider: 'google',
      code: 'oauth-code',
      state,
    });

    await expect(service.completeLink({
      provider: 'google',
      code: 'oauth-code',
      state,
    })).rejects.toBeInstanceOf(AccountConnectionError);
  });
});
