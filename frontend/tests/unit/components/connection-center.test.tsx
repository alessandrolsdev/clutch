import React, { type ReactElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConnectionCenter } from '@/components/settings/connection-center';
import type { ConnectedAccount, ConnectedAccountProviderDefinition } from '@/schemas/integrations';
import {
  fetchConnectedAccounts,
  startAccountLink,
  startAccountReauth,
  unlinkConnectedAccount,
  updateConnectedAccountVisibility,
} from '@/services/integrations';

vi.mock('@/services/integrations', () => ({
  fetchConnectedAccounts: vi.fn(),
  startAccountLink: vi.fn(),
  startAccountReauth: vi.fn(),
  unlinkConnectedAccount: vi.fn(),
  updateConnectedAccountVisibility: vi.fn(),
  IntegrationsRequestError: class IntegrationsRequestError extends Error {
    public readonly status: number;

    constructor(status: number, message: string) {
      super(message);
      this.name = 'IntegrationsRequestError';
      this.status = status;
    }
  },
}));

const mockedFetchConnectedAccounts = vi.mocked(fetchConnectedAccounts);
const mockedStartAccountLink = vi.mocked(startAccountLink);
const mockedStartAccountReauth = vi.mocked(startAccountReauth);
const mockedUnlinkConnectedAccount = vi.mocked(unlinkConnectedAccount);
const mockedUpdateConnectedAccountVisibility = vi.mocked(updateConnectedAccountVisibility);

function renderWithQuery(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

function createAccount(overrides: Partial<ConnectedAccount> = {}): ConnectedAccount {
  return {
    provider: 'GOOGLE',
    displayName: 'Google',
    externalId: 'google-external-id',
    connectionType: 'SOCIAL_LOGIN',
    status: 'CONNECTED',
    dataSource: 'OFFICIAL',
    publicProfileVisible: false,
    connected: true,
    needsReauth: false,
    experimental: false,
    canUnlink: true,
    capabilities: ['SOCIAL_LOGIN', 'OAUTH_CONNECT'],
    lastSyncAt: null,
    createdAt: '2026-04-29T10:00:00.000Z',
    updatedAt: '2026-04-29T10:00:00.000Z',
    ...overrides,
  };
}

const providerDefinitions: ConnectedAccountProviderDefinition[] = [
  {
    provider: 'GOOGLE',
    displayName: 'Google',
    status: 'CONNECTED',
    dataSource: 'OFFICIAL',
    capabilities: ['SOCIAL_LOGIN', 'OAUTH_CONNECT'],
  },
  {
    provider: 'DISCORD',
    displayName: 'Discord',
    status: 'CONNECTED',
    dataSource: 'OFFICIAL',
    capabilities: ['SOCIAL_LOGIN', 'CONNECTED_ACCOUNT', 'OAUTH_CONNECT', 'PRESENCE_INGESTION'],
  },
  {
    provider: 'STEAM',
    displayName: 'Steam',
    status: 'CONNECTED',
    dataSource: 'OFFICIAL',
    capabilities: ['CONNECTED_ACCOUNT', 'LIBRARY_IMPORT'],
  },
  {
    provider: 'EPIC',
    displayName: 'Epic Games',
    status: 'EXPERIMENTAL',
    dataSource: 'EXPERIMENTAL',
    capabilities: ['CONNECTED_ACCOUNT', 'TOKEN_CONNECT', 'LIBRARY_IMPORT'],
  },
];

describe('ConnectionCenter', () => {
  beforeEach(() => {
    mockedFetchConnectedAccounts.mockReset();
    mockedStartAccountLink.mockReset();
    mockedStartAccountReauth.mockReset();
    mockedUnlinkConnectedAccount.mockReset();
    mockedUpdateConnectedAccountVisibility.mockReset();
  });

  it('renderiza contas conectadas sem expor tokens', async () => {
    mockedFetchConnectedAccounts.mockResolvedValue({
      providers: providerDefinitions,
      accounts: [
        createAccount(),
      ],
    });

    renderWithQuery(<ConnectionCenter />);

    await waitFor(() => {
      expect(screen.getByTestId('connection-center')).toBeInTheDocument();
    });

    expect(screen.getByText(/central de conexoes/i)).toBeInTheDocument();
    expect(screen.getByTestId('connection-provider-google')).toHaveTextContent('Ativa');
    expect(screen.getByTestId('connection-provider-google')).not.toHaveTextContent('google-external-id');
    expect(screen.queryByText(/accessToken/i)).not.toBeInTheDocument();
  });

  it('mostra estado vazio quando nao ha contas conectadas', async () => {
    mockedFetchConnectedAccounts.mockResolvedValue({
      providers: providerDefinitions,
      accounts: [],
    });

    renderWithQuery(<ConnectionCenter />);

    await waitFor(() => {
      expect(screen.getByTestId('connection-center-empty')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /conectar google/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /conectar discord/i })).toBeInTheDocument();
  });

  it('mostra erro de carregamento', async () => {
    mockedFetchConnectedAccounts.mockRejectedValue(new Error('network'));

    renderWithQuery(<ConnectionCenter />);

    await waitFor(() => {
      expect(screen.getByTestId('connection-center-error')).toBeInTheDocument();
    });
  });

  it('inicia linking e redireciona para authorizationUrl', async () => {
    const onRedirect = vi.fn();
    mockedFetchConnectedAccounts.mockResolvedValue({
      providers: providerDefinitions,
      accounts: [],
    });
    mockedStartAccountLink.mockResolvedValue({
      provider: 'GOOGLE',
      authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth?state=signed-state',
    });

    renderWithQuery(<ConnectionCenter onRedirect={onRedirect} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /conectar google/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /conectar google/i }));

    await waitFor(() => {
      expect(mockedStartAccountLink.mock.calls[0]?.[0]).toBe('GOOGLE');
    });
    expect(onRedirect).toHaveBeenCalledWith('https://accounts.google.com/o/oauth2/v2/auth?state=signed-state');
  });

  it('mostra NEEDS_REAUTH com CTA de reconectar', async () => {
    const onRedirect = vi.fn();
    mockedFetchConnectedAccounts.mockResolvedValue({
      providers: providerDefinitions,
      accounts: [
        createAccount({
          provider: 'DISCORD',
          displayName: 'Discord',
          externalId: 'discord-external-id',
          status: 'NEEDS_REAUTH',
          connected: false,
          needsReauth: true,
          canUnlink: true,
        }),
      ],
    });
    mockedStartAccountReauth.mockResolvedValue({
      provider: 'DISCORD',
      authorizationUrl: 'https://discord.com/oauth2/authorize?state=signed-state',
    });

    renderWithQuery(<ConnectionCenter onRedirect={onRedirect} />);

    await waitFor(() => {
      expect(screen.getByTestId('connection-provider-discord')).toHaveTextContent('Precisa reconectar');
    });

    fireEvent.click(screen.getByRole('button', { name: /reconectar discord/i }));

    await waitFor(() => {
      expect(mockedStartAccountReauth.mock.calls[0]?.[0]).toBe('DISCORD');
    });
    expect(onRedirect).toHaveBeenCalledWith('https://discord.com/oauth2/authorize?state=signed-state');
  });

  it('desconecta conta quando permitido', async () => {
    mockedFetchConnectedAccounts.mockResolvedValue({
      providers: providerDefinitions,
      accounts: [createAccount()],
    });
    mockedUnlinkConnectedAccount.mockResolvedValue({
      provider: 'GOOGLE',
      message: 'Google desconectado com sucesso.',
    });

    renderWithQuery(<ConnectionCenter />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /desconectar google/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /desconectar google/i }));

    await waitFor(() => {
      expect(mockedUnlinkConnectedAccount.mock.calls[0]?.[0]).toBe('GOOGLE');
    });
    expect(await screen.findByText(/google desconectado com sucesso/i)).toBeInTheDocument();
  });

  it('alterna visibilidade publica da conta conectada', async () => {
    mockedFetchConnectedAccounts.mockResolvedValue({
      providers: providerDefinitions,
      accounts: [createAccount()],
    });
    mockedUpdateConnectedAccountVisibility.mockResolvedValue(createAccount({
      publicProfileVisible: true,
    }));

    renderWithQuery(<ConnectionCenter />);

    fireEvent.click(await screen.findByRole('button', { name: /tornar publica/i }));

    await waitFor(() => {
      expect(mockedUpdateConnectedAccountVisibility).toHaveBeenCalledWith('GOOGLE', {
        publicProfileVisible: true,
      });
    });
    expect(await screen.findByText(/agora aparece no perfil publico/i)).toBeInTheDocument();
  });

  it('mostra erro quando visibilidade publica e bloqueada pelo backend', async () => {
    mockedFetchConnectedAccounts.mockResolvedValue({
      providers: providerDefinitions,
      accounts: [createAccount()],
    });
    mockedUpdateConnectedAccountVisibility.mockRejectedValue(new Error('Apenas contas ativas e oficiais podem aparecer publicamente.'));

    renderWithQuery(<ConnectionCenter />);

    fireEvent.click(await screen.findByRole('button', { name: /tornar publica/i }));

    expect(await screen.findByText(/nao foi possivel atualizar a visibilidade agora/i)).toBeInTheDocument();
  });

  it('nao sugere publicacao para Epic experimental', async () => {
    mockedFetchConnectedAccounts.mockResolvedValue({
      providers: providerDefinitions,
      accounts: [
        createAccount({
          provider: 'EPIC',
          displayName: 'Epic Games',
          externalId: 'legacy:epic:user-id-1',
          dataSource: 'EXPERIMENTAL',
          status: 'NEEDS_REAUTH',
          connected: false,
          needsReauth: true,
          experimental: true,
          capabilities: ['CONNECTED_ACCOUNT', 'TOKEN_CONNECT', 'LIBRARY_IMPORT'],
        }),
      ],
    });

    renderWithQuery(<ConnectionCenter />);

    const epicCard = await screen.findByTestId('connection-provider-epic');
    const publishButton = within(epicCard).getByRole('button', { name: /tornar publica/i });

    expect(publishButton).toBeDisabled();
    expect(epicCard).toHaveTextContent(/apenas contas ativas e oficiais/i);
    expect(mockedUpdateConnectedAccountVisibility).not.toHaveBeenCalled();
  });

  it('desabilita unlink quando backend indica que removeria ultimo metodo de login', async () => {
    mockedFetchConnectedAccounts.mockResolvedValue({
      providers: providerDefinitions,
      accounts: [
        createAccount({
          canUnlink: false,
        }),
      ],
    });

    renderWithQuery(<ConnectionCenter />);

    const unlinkButton = await screen.findByRole('button', { name: /desconectar google/i });

    expect(unlinkButton).toBeDisabled();
    expect(screen.getByText(/metodo de login viavel/i)).toBeInTheDocument();
  });

  it('exibe erro quando unlink e bloqueado pelo backend', async () => {
    mockedFetchConnectedAccounts.mockResolvedValue({
      providers: providerDefinitions,
      accounts: [createAccount()],
    });
    mockedUnlinkConnectedAccount.mockRejectedValue(new Error('Nao e possivel remover o ultimo metodo de login.'));

    renderWithQuery(<ConnectionCenter />);

    fireEvent.click(await screen.findByRole('button', { name: /desconectar google/i }));

    expect(await screen.findByText(/nao foi possivel desconectar esta conta agora/i)).toBeInTheDocument();
  });
});
