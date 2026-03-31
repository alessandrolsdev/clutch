import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SteamIntegrationCard } from '@/components/settings/steam-integration-card';
import { connectSteam, syncSteamLibrary } from '@/services/integrations';

vi.mock('@/services/integrations', () => ({
  connectSteam: vi.fn(),
  syncSteamLibrary: vi.fn(),
  IntegrationsRequestError: class IntegrationsRequestError extends Error {
    public readonly status: number;

    constructor(status: number, message: string) {
      super(message);
      this.name = 'IntegrationsRequestError';
      this.status = status;
    }
  },
}));

const mockedConnectSteam = vi.mocked(connectSteam);
const mockedSyncSteamLibrary = vi.mocked(syncSteamLibrary);

function renderSteamIntegrationCard() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <SteamIntegrationCard
        isConnected
        importedPreviewCount={3}
        onRefreshStatus={vi.fn().mockResolvedValue(undefined)}
      />
    </QueryClientProvider>,
  );
}

describe('SteamIntegrationCard', () => {
  beforeEach(() => {
    mockedConnectSteam.mockReset();
    mockedSyncSteamLibrary.mockReset();
  });

  it('connects steam with the form payload', async () => {
    mockedConnectSteam.mockResolvedValue({
      message: 'Steam conectado. 2 jogos importados.',
      imported: 2,
    });

    renderSteamIntegrationCard();

    fireEvent.change(screen.getByLabelText(/steamid/i), {
      target: { value: '76561198000000000' },
    });
    fireEvent.click(screen.getByRole('button', { name: /conectar steam/i }));

    await waitFor(() => {
      expect(mockedConnectSteam).toHaveBeenCalled();
    });

    expect(mockedConnectSteam.mock.calls[0]?.[0]).toEqual({
      steamId: '76561198000000000',
    });
  });

  it('syncs the steam library when requested', async () => {
    mockedSyncSteamLibrary.mockResolvedValue({
      message: '1 jogos sincronizados.',
      synced: 1,
    });

    renderSteamIntegrationCard();

    fireEvent.click(screen.getByRole('button', { name: /sincronizar biblioteca/i }));

    await waitFor(() => {
      expect(mockedSyncSteamLibrary).toHaveBeenCalled();
    });
  });
});
