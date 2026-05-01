import React, { type ReactElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OtakuShowcaseManager } from '@/components/settings/otaku-showcase-manager';
import {
  fetchOtakuLibrary,
  updateOtakuShowcaseEntry,
} from '@/services/otaku';

vi.mock('next/image', () => ({
  default: (props: { alt?: string }) => <span data-testid="mock-image">{props.alt}</span>,
}));

vi.mock('@/services/otaku', () => ({
  fetchOtakuLibrary: vi.fn(),
  updateOtakuShowcaseEntry: vi.fn(),
  OtakuRequestError: class OtakuRequestError extends Error {
    public readonly status: number;

    constructor(status: number, message: string) {
      super(message);
      this.name = 'OtakuRequestError';
      this.status = status;
    }
  },
}));

const mockedFetchOtakuLibrary = vi.mocked(fetchOtakuLibrary);
const mockedUpdateOtakuShowcaseEntry = vi.mocked(updateOtakuShowcaseEntry);

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

const baseEntry = {
  id: 'entry-1',
  kind: 'ANIME' as const,
  title: 'Sousou no Frieren',
  coverUrl: null,
  status: 'CONSUMING' as const,
  progress: 4,
  score: 9,
  showcaseRank: null,
  updatedAt: '2026-04-30T18:00:00.000Z',
};

describe('OtakuShowcaseManager', () => {
  beforeEach(() => {
    mockedFetchOtakuLibrary.mockReset();
    mockedUpdateOtakuShowcaseEntry.mockReset();
  });

  it('mostra empty state quando nao ha importacao otaku', async () => {
    mockedFetchOtakuLibrary.mockResolvedValue({
      maxShowcaseItems: 3,
      entries: [],
    });

    renderWithQuery(<OtakuShowcaseManager />);

    expect(await screen.findByTestId('otaku-library-empty')).toHaveTextContent(
      /importe listas do myanimelist/i,
    );
  });

  it('renderiza itens importados com copy de privacidade', async () => {
    mockedFetchOtakuLibrary.mockResolvedValue({
      maxShowcaseItems: 3,
      entries: [baseEntry],
    });

    renderWithQuery(<OtakuShowcaseManager />);

    const manager = await screen.findByTestId('otaku-showcase-manager');
    await screen.findByText('Sousou no Frieren');

    expect(manager).toHaveTextContent('Showcase otaku');
    expect(manager).toHaveTextContent(/biblioteca completa continua privada/i);
    expect(manager).toHaveTextContent(/nada e publicado no feed/i);
    expect(within(manager).getByText('Sousou no Frieren')).toBeInTheDocument();
    expect(within(manager).getByRole('button', { name: /destacar/i })).toBeInTheDocument();
  });

  it('permite destacar item usando proxima posicao livre', async () => {
    mockedFetchOtakuLibrary.mockResolvedValue({
      maxShowcaseItems: 3,
      entries: [
        {
          ...baseEntry,
          id: 'entry-1',
          title: 'Blue Lock',
          showcaseRank: 1,
        },
        {
          ...baseEntry,
          id: 'entry-2',
          title: 'Dungeon Meshi',
          showcaseRank: null,
        },
      ],
    });
    mockedUpdateOtakuShowcaseEntry.mockResolvedValue({
      entry: {
        ...baseEntry,
        id: 'entry-2',
        title: 'Dungeon Meshi',
        showcaseRank: 2,
      },
    });

    renderWithQuery(<OtakuShowcaseManager />);

    const dungeonRow = await screen.findByText('Dungeon Meshi');
    const row = dungeonRow.closest('[data-testid="otaku-library-entry"]');

    expect(row).not.toBeNull();
    fireEvent.click(within(row as HTMLElement).getByRole('button', { name: /destacar/i }));

    await waitFor(() => {
      expect(mockedUpdateOtakuShowcaseEntry).toHaveBeenCalledWith('entry-2', {
        showcaseRank: 2,
      });
    });
    expect(await screen.findByText(/dungeon meshi agora aparece no showcase publico/i))
      .toBeInTheDocument();
  });

  it('permite remover destaque sem apagar item', async () => {
    mockedFetchOtakuLibrary.mockResolvedValue({
      maxShowcaseItems: 3,
      entries: [
        {
          ...baseEntry,
          showcaseRank: 1,
        },
      ],
    });
    mockedUpdateOtakuShowcaseEntry.mockResolvedValue({
      entry: {
        ...baseEntry,
        showcaseRank: null,
      },
    });

    renderWithQuery(<OtakuShowcaseManager />);

    fireEvent.click(await screen.findByRole('button', { name: /remover destaque/i }));

    await waitFor(() => {
      expect(mockedUpdateOtakuShowcaseEntry).toHaveBeenCalledWith('entry-1', {
        showcaseRank: null,
      });
    });
    expect(await screen.findByText(/sousou no frieren saiu do showcase publico/i))
      .toBeInTheDocument();
  });

  it('desabilita destaque quando limite foi atingido', async () => {
    mockedFetchOtakuLibrary.mockResolvedValue({
      maxShowcaseItems: 3,
      entries: [
        { ...baseEntry, id: 'entry-1', title: 'A', showcaseRank: 1 },
        { ...baseEntry, id: 'entry-2', title: 'B', showcaseRank: 2 },
        { ...baseEntry, id: 'entry-3', title: 'C', showcaseRank: 3 },
        { ...baseEntry, id: 'entry-4', title: 'D', showcaseRank: null },
      ],
    });

    renderWithQuery(<OtakuShowcaseManager />);

    expect(await screen.findByText(/limite atingido/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^destacar$/i })).toBeDisabled();
  });

  it('mostra erro seguro quando backend bloqueia alteracao', async () => {
    mockedFetchOtakuLibrary.mockResolvedValue({
      maxShowcaseItems: 3,
      entries: [baseEntry],
    });
    mockedUpdateOtakuShowcaseEntry.mockRejectedValue(
      new Error('O showcase otaku aceita no máximo 3 itens.'),
    );

    renderWithQuery(<OtakuShowcaseManager />);

    fireEvent.click(await screen.findByRole('button', { name: /destacar/i }));

    expect(await screen.findByText(/nao foi possivel atualizar o showcase otaku agora/i))
      .toBeInTheDocument();
  });
});
