import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiRequest } from '@/lib/api';
import {
  fetchArenaChallenges,
  fetchArenaLeaderboard,
  joinArenaChallenge,
  submitArenaProof,
} from '@/services/arena';

vi.mock('@/lib/api', () => ({
  apiRequest: vi.fn(),
}));

const mockedApiRequest = vi.mocked(apiRequest);

const challengePayload = {
  id: 'challenge-id-1',
  slug: 'semana-da-game-session',
  title: 'Semana da Game Session',
  description: 'Envie GAME_SESSION da semana.',
  startsAt: '2026-05-01T00:00:00.000Z',
  endsAt: '2026-05-08T00:00:00.000Z',
  status: 'ACTIVE',
  ruleType: 'GAME_SESSION',
  scoreValue: 10,
  maxSubmissionsPerUser: 3,
  participantCount: 1,
  submissionCount: 0,
  viewerHasJoined: false,
  viewerJoinedAt: null,
  createdAt: '2026-05-01T00:00:00.000Z',
  updatedAt: '2026-05-01T00:00:00.000Z',
};

describe('arena service', () => {
  beforeEach(() => {
    mockedApiRequest.mockReset();
  });

  it('lista desafios Arena ativos', async () => {
    mockedApiRequest.mockResolvedValue(
      new Response(JSON.stringify({ challenges: [challengePayload] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const response = await fetchArenaChallenges();

    expect(response[0]?.slug).toBe('semana-da-game-session');
    expect(mockedApiRequest).toHaveBeenCalledWith('/arena/challenges', {
      method: 'GET',
    });
  });

  it('entra em desafio Arena', async () => {
    mockedApiRequest.mockResolvedValue(
      new Response(
        JSON.stringify({
          challenge: { ...challengePayload, viewerHasJoined: true },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    const response = await joinArenaChallenge('challenge-id-1');

    expect(response.viewerHasJoined).toBe(true);
    expect(mockedApiRequest).toHaveBeenCalledWith('/arena/challenges/challenge-id-1/join', {
      method: 'POST',
    });
  });

  it('submete prova elegivel', async () => {
    mockedApiRequest.mockResolvedValue(
      new Response(
        JSON.stringify({
          submission: {
            id: 'submission-id-1',
            challengeId: 'challenge-id-1',
            userId: 'user-id-1',
            proofType: 'GAME_SESSION',
            proofId: 'post-id-1',
            score: 10,
            submittedAt: '2026-05-01T12:00:00.000Z',
          },
        }),
        {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    const response = await submitArenaProof('challenge-id-1', {
      proofType: 'GAME_SESSION',
      proofId: 'post-id-1',
    });

    expect(response.score).toBe(10);
    expect(mockedApiRequest).toHaveBeenCalledWith(
      '/arena/challenges/challenge-id-1/submissions',
      {
        method: 'POST',
        body: {
          proofType: 'GAME_SESSION',
          proofId: 'post-id-1',
        },
      },
    );
  });

  it('lista ranking local do desafio', async () => {
    mockedApiRequest.mockResolvedValue(
      new Response(
        JSON.stringify({
          leaderboard: [
            {
              position: 1,
              userId: 'user-id-1',
              username: 'clutchplayer',
              displayName: 'Clutch Player',
              score: 20,
              submissionsCount: 2,
              lastSubmissionAt: '2026-05-01T12:00:00.000Z',
            },
          ],
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    const response = await fetchArenaLeaderboard('challenge-id-1');

    expect(response[0]?.position).toBe(1);
    expect(mockedApiRequest).toHaveBeenCalledWith(
      '/arena/challenges/challenge-id-1/leaderboard',
      {
        method: 'GET',
      },
    );
  });
});
