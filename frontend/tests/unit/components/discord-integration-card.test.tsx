import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DiscordIntegrationCard } from '@/components/settings/discord-integration-card';
import {
  IntegrationsRequestError,
  startDiscordOAuth,
} from '@/services/integrations';

vi.mock('@/services/integrations', () => ({
  startDiscordOAuth: vi.fn(),
  IntegrationsRequestError: class IntegrationsRequestError extends Error {
    public readonly status: number;

    constructor(status: number, message: string) {
      super(message);
      this.name = 'IntegrationsRequestError';
      this.status = status;
    }
  },
}));

const mockedStartDiscordOAuth = vi.mocked(startDiscordOAuth);

function renderDiscordIntegrationCard(props?: {
  isConnected?: boolean;
  linkedAccountLabel?: string | null;
  onRedirect?: (authorizationUrl: string) => void;
}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <DiscordIntegrationCard
        isConnected={props?.isConnected ?? false}
        linkedAccountLabel={props?.linkedAccountLabel ?? null}
        onRedirect={props?.onRedirect}
      />
    </QueryClientProvider>,
  );
}

describe('DiscordIntegrationCard', () => {
  beforeEach(() => {
    mockedStartDiscordOAuth.mockReset();
    vi.restoreAllMocks();
  });

  it('starts the discord oauth flow and redirects to the provider url', async () => {
    const onRedirect = vi.fn();

    mockedStartDiscordOAuth.mockResolvedValue({
      authorizationUrl: 'https://discord.com/oauth2/authorize?client_id=123',
    });

    renderDiscordIntegrationCard({ onRedirect });

    fireEvent.click(screen.getByRole('button', { name: /conectar discord/i }));

    await waitFor(() => {
      expect(mockedStartDiscordOAuth).toHaveBeenCalledTimes(1);
    });

    expect(onRedirect).toHaveBeenCalledWith(
      'https://discord.com/oauth2/authorize?client_id=123',
    );
  });

  it('shows a safe error message when oauth start fails', async () => {
    mockedStartDiscordOAuth.mockRejectedValue(
      new Error('Nao foi possivel iniciar a conexao com o Discord agora.'),
    );

    renderDiscordIntegrationCard();

    fireEvent.click(screen.getByRole('button', { name: /conectar discord/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/nao foi possivel iniciar a conexao com o discord agora/i),
      ).toBeInTheDocument();
    });
  });

  it('shows a coherent unavailable message when backend discord is not configured', async () => {
    mockedStartDiscordOAuth.mockRejectedValue(
      new IntegrationsRequestError(
        503,
        'Integração Discord indisponível no runtime atual.',
      ),
    );

    renderDiscordIntegrationCard();

    fireEvent.click(screen.getByRole('button', { name: /conectar discord/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/integração discord indisponível no runtime atual/i),
      ).toBeInTheDocument();
    });
  });
});
