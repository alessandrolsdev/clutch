import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IgdbSearchCard } from '@/components/settings/igdb-search-card';
import { searchIgdbGame } from '@/services/integrations';

vi.mock('@/services/integrations', () => ({
  searchIgdbGame: vi.fn(),
  IntegrationsRequestError: class IntegrationsRequestError extends Error {
    public readonly status: number;

    constructor(status: number, message: string) {
      super(message);
      this.name = 'IntegrationsRequestError';
      this.status = status;
    }
  },
}));

const mockedSearchIgdbGame = vi.mocked(searchIgdbGame);

function renderIgdbSearchCard() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <IgdbSearchCard />
    </QueryClientProvider>,
  );
}

describe('IgdbSearchCard', () => {
  beforeEach(() => {
    mockedSearchIgdbGame.mockReset();
  });

  it('searches igdb and renders the returned game', async () => {
    mockedSearchIgdbGame.mockResolvedValue({
      id: 730,
      name: 'Counter-Strike 2',
      coverUrl: 'https://images.ct2.jpg',
      platforms: ['PC'],
      summary: 'Competitive FPS',
    });

    renderIgdbSearchCard();

    fireEvent.change(screen.getByLabelText(/nome do jogo/i), {
      target: { value: 'Counter-Strike 2' },
    });
    fireEvent.click(screen.getByRole('button', { name: /buscar no igdb/i }));

    await waitFor(() => {
      expect(mockedSearchIgdbGame).toHaveBeenCalledWith('Counter-Strike 2');
    });

    expect(await screen.findByText(/counter-strike 2/i)).toBeInTheDocument();
    expect(screen.getByText(/competitive fps/i)).toBeInTheDocument();
  });
});
