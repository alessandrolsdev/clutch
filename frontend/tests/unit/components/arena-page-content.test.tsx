import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ArenaPageContent } from '@/components/arena/arena-page-content';
import { useAuth } from '@/hooks/use-auth';
import {
  fetchArenaChallenges,
  fetchArenaLeaderboard,
  joinArenaChallenge,
  submitArenaProof,
} from '@/services/arena';

vi.mock('@/hooks/use-auth', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/services/arena', () => ({
  ArenaRequestError: class ArenaRequestError extends Error {
    status: number;

    constructor(status: number, message: string) {
      super(message);
      this.status = status;
      this.name = 'ArenaRequestError';
    }
  },
  fetchArenaChallenges: vi.fn(),
  fetchArenaLeaderboard: vi.fn(),
  joinArenaChallenge: vi.fn(),
  submitArenaProof: vi.fn(),
}));

const mockedUseAuth = vi.mocked(useAuth);
const mockedFetchArenaChallenges = vi.mocked(fetchArenaChallenges);
const mockedFetchArenaLeaderboard = vi.mocked(fetchArenaLeaderboard);
const mockedJoinArenaChallenge = vi.mocked(joinArenaChallenge);
const mockedSubmitArenaProof = vi.mocked(submitArenaProof);

const challenge = {
  id: 'challenge-id-1',
  slug: 'semana-da-game-session',
  title: 'Semana da Game Session',
  description: 'Envie GAME_SESSION da semana.',
  startsAt: '2026-05-01T00:00:00.000Z',
  endsAt: '2026-05-08T00:00:00.000Z',
  status: 'ACTIVE' as const,
  ruleType: 'GAME_SESSION' as const,
  scoreValue: 10,
  maxSubmissionsPerUser: 3,
  participantCount: 1,
  submissionCount: 0,
  viewerHasJoined: false,
  viewerJoinedAt: null,
  createdAt: '2026-05-01T00:00:00.000Z',
  updatedAt: '2026-05-01T00:00:00.000Z',
};

function renderArenaPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <ArenaPageContent />
    </QueryClientProvider>,
  );
}

describe('ArenaPageContent', () => {
  beforeEach(() => {
    mockedUseAuth.mockReset();
    mockedFetchArenaChallenges.mockReset();
    mockedFetchArenaLeaderboard.mockReset();
    mockedJoinArenaChallenge.mockReset();
    mockedSubmitArenaProof.mockReset();
    mockedUseAuth.mockReturnValue({
      user: { id: 'user-id-1', username: 'clutchplayer', email: 'player@clutch.gg' },
      status: 'authenticated',
      logout: vi.fn(),
    });
    mockedFetchArenaLeaderboard.mockResolvedValue([]);
  });

  it('renderiza lista de desafios e regras do MVP', async () => {
    mockedFetchArenaChallenges.mockResolvedValue([challenge]);

    renderArenaPage();

    expect(await screen.findAllByText('Semana da Game Session')).toHaveLength(2);
    expect(screen.getByText(/10 pts por prova/i)).toBeInTheDocument();
    expect(screen.getByText(/Cap 3 provas/i)).toBeInTheDocument();
    expect(screen.getByText(/Ranking local, sem season formal/i)).toBeInTheDocument();
  });

  it('renderiza empty state sem desafios', async () => {
    mockedFetchArenaChallenges.mockResolvedValue([]);

    renderArenaPage();

    expect(await screen.findByText(/Ainda não há desafios Arena ativos/i)).toBeInTheDocument();
  });

  it('entra em desafio voluntariamente', async () => {
    mockedFetchArenaChallenges.mockResolvedValue([challenge]);
    mockedJoinArenaChallenge.mockResolvedValue({
      ...challenge,
      viewerHasJoined: true,
      viewerJoinedAt: '2026-05-01T10:00:00.000Z',
    });

    renderArenaPage();

    fireEvent.click(await screen.findByRole('button', { name: /Entrar no desafio/i }));

    await waitFor(() => {
      expect(mockedJoinArenaChallenge).toHaveBeenCalledWith('challenge-id-1');
    });
  });

  it('submete prova quando usuario ja participa', async () => {
    mockedFetchArenaChallenges.mockResolvedValue([
      {
        ...challenge,
        viewerHasJoined: true,
        viewerJoinedAt: '2026-05-01T10:00:00.000Z',
      },
    ]);
    mockedSubmitArenaProof.mockResolvedValue({
      id: 'submission-id-1',
      challengeId: 'challenge-id-1',
      userId: 'user-id-1',
      proofType: 'GAME_SESSION',
      proofId: 'post-id-1',
      score: 10,
      submittedAt: '2026-05-01T12:00:00.000Z',
    });

    renderArenaPage();

    fireEvent.change(await screen.findByLabelText(/ID do post de prova/i), {
      target: { value: 'post-id-1' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Submeter prova/i }));

    await waitFor(() => {
      expect(mockedSubmitArenaProof).toHaveBeenCalledWith('challenge-id-1', {
        proofType: 'GAME_SESSION',
        proofId: 'post-id-1',
      });
    });
  });

  it('exibe ranking local do desafio', async () => {
    mockedFetchArenaChallenges.mockResolvedValue([challenge]);
    mockedFetchArenaLeaderboard.mockResolvedValue([
      {
        position: 1,
        userId: 'user-id-1',
        username: 'clutchplayer',
        displayName: 'Clutch Player',
        score: 20,
        submissionsCount: 2,
        lastSubmissionAt: '2026-05-01T12:00:00.000Z',
      },
    ]);

    renderArenaPage();

    expect(await screen.findByText('Clutch Player')).toBeInTheDocument();
    expect(screen.getByText('#1')).toBeInTheDocument();
    expect(screen.getByText('20')).toBeInTheDocument();
  });

  it('mostra erro seguro do backend', async () => {
    mockedFetchArenaChallenges.mockResolvedValue([
      {
        ...challenge,
        viewerHasJoined: true,
        viewerJoinedAt: '2026-05-01T10:00:00.000Z',
      },
    ]);
    mockedSubmitArenaProof.mockRejectedValue(new Error('Esta prova já foi usada neste desafio.'));

    renderArenaPage();

    fireEvent.change(await screen.findByLabelText(/ID do post de prova/i), {
      target: { value: 'post-id-1' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Submeter prova/i }));

    expect(await screen.findByText(/Não foi possível submeter esta prova/i)).toBeInTheDocument();
  });
});
