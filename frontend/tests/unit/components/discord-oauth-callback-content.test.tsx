import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DiscordOAuthCallbackContent } from '@/components/settings/discord-oauth-callback-content';
import { completeDiscordOAuth } from '@/services/integrations';

vi.mock('@/services/integrations', () => ({
  completeDiscordOAuth: vi.fn(),
  IntegrationsRequestError: class IntegrationsRequestError extends Error {
    public readonly status: number;

    constructor(status: number, message: string) {
      super(message);
      this.name = 'IntegrationsRequestError';
      this.status = status;
    }
  },
}));

const mockedCompleteDiscordOAuth = vi.mocked(completeDiscordOAuth);

function renderCallbackContent(searchParams: {
  code?: string;
  state?: string;
  error?: string;
  errorDescription?: string;
}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

  render(
    <QueryClientProvider client={queryClient}>
      <DiscordOAuthCallbackContent searchParams={searchParams} />
    </QueryClientProvider>,
  );

  return { invalidateQueriesSpy };
}

describe('DiscordOAuthCallbackContent', () => {
  beforeEach(() => {
    mockedCompleteDiscordOAuth.mockReset();
  });

  it('fails fast when callback params are invalid', async () => {
    renderCallbackContent({});

    await waitFor(() => {
      expect(screen.getByTestId('discord-callback-error')).toBeInTheDocument();
    });

    expect(screen.getByText('Callback Discord inválido.')).toBeInTheDocument();
    expect(mockedCompleteDiscordOAuth).not.toHaveBeenCalled();
  });

  it('completes the discord callback and invalidates cached profiles', async () => {
    mockedCompleteDiscordOAuth.mockResolvedValue({
      message: 'Discord conectado com sucesso.',
      platform: 'DISCORD',
      externalId: 'discord-user-1',
      username: 'clutchplayer',
      globalName: 'CLUTCH Player',
    });

    const { invalidateQueriesSpy } = renderCallbackContent({
      code: 'oauth-code',
      state: 'signed-state',
    });

    await waitFor(() => {
      expect(screen.getByTestId('discord-callback-success')).toBeInTheDocument();
    });

    expect(screen.getByText(/discord conectado com sucesso/i)).toBeInTheDocument();
    expect(screen.getByText(/clutch player/i)).toBeInTheDocument();
    expect(mockedCompleteDiscordOAuth).toHaveBeenCalledWith({
      code: 'oauth-code',
      state: 'signed-state',
    });
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['profile'] });
  });

  it('shows a safe error message when the provider callback fails', async () => {
    mockedCompleteDiscordOAuth.mockRejectedValue(
      new Error('Nao foi possivel concluir a conexao com o Discord agora.'),
    );

    renderCallbackContent({
      error: 'access_denied',
      errorDescription: 'User denied access',
    });

    await waitFor(() => {
      expect(screen.getByTestId('discord-callback-error')).toBeInTheDocument();
    });

    expect(
      screen.getByText(/nao foi possivel concluir a conexao com o discord agora/i),
    ).toBeInTheDocument();
  });

  it('does not re-run the callback request on rerender with the same params', async () => {
    mockedCompleteDiscordOAuth.mockResolvedValue({
      message: 'Discord conectado com sucesso.',
      platform: 'DISCORD',
      externalId: 'discord-user-1',
      username: 'clutchplayer',
      globalName: 'CLUTCH Player',
    });

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    const view = render(
      <QueryClientProvider client={queryClient}>
        <DiscordOAuthCallbackContent
          searchParams={{ code: 'oauth-code', state: 'signed-state' }}
        />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('discord-callback-success')).toBeInTheDocument();
    });

    view.rerender(
      <QueryClientProvider client={queryClient}>
        <DiscordOAuthCallbackContent
          searchParams={{ code: 'oauth-code', state: 'signed-state' }}
        />
      </QueryClientProvider>,
    );

    expect(mockedCompleteDiscordOAuth).toHaveBeenCalledTimes(1);
  });
});
