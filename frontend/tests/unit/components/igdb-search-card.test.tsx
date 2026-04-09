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
      games: [
        {
          id: 730,
          name: 'Counter-Strike 2',
          coverUrl: 'https://images.ct2.jpg',
          platforms: ['PC'],
          summary: 'Competitive FPS',
        },
      ],
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
    expect(screen.getByText(/busca direta concluida com um candidato unico/i)).toBeInTheDocument();
  });

  it('renders multiple candidates and lets the user select one explicitly', async () => {
    mockedSearchIgdbGame.mockResolvedValue({
      games: [
        {
          id: 1,
          name: 'DOOM',
          coverUrl: null,
          platforms: ['PC'],
          summary: 'Classic shooter',
        },
        {
          id: 2,
          name: 'DOOM Eternal',
          coverUrl: null,
          platforms: ['PC', 'PlayStation 5'],
          summary: 'Modern shooter',
        },
      ],
    });

    renderIgdbSearchCard();

    fireEvent.change(screen.getByLabelText(/nome do jogo/i), {
      target: { value: 'DOOM' },
    });
    fireEvent.click(screen.getByRole('button', { name: /buscar no igdb/i }));

    expect(await screen.findByTestId('igdb-search-results')).toBeInTheDocument();
    expect(screen.getByText(/possiveis resultados/i)).toBeInTheDocument();
    expect(screen.queryByTestId('igdb-search-selected')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /doom eternal/i }));

    expect(await screen.findByTestId('igdb-search-selected')).toBeInTheDocument();
    expect(screen.getByText(/modern shooter/i)).toBeInTheDocument();
  });

  it('renders an honest empty state when the backend returns no candidates', async () => {
    mockedSearchIgdbGame.mockResolvedValue({
      games: [],
    });

    renderIgdbSearchCard();

    fireEvent.change(screen.getByLabelText(/nome do jogo/i), {
      target: { value: 'Unknown Game' },
    });
    fireEvent.click(screen.getByRole('button', { name: /buscar no igdb/i }));

    expect(await screen.findByTestId('igdb-search-empty')).toBeInTheDocument();
  });
});
