import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ArenaChallengeStatus,
  ArenaProofType,
} from '@prisma/client';
import { buildApp, generateTestToken } from '../../helpers/build-app';
import {
  arenaService,
  ArenaServiceError,
} from '@/core/services/arena.service';

vi.mock('@/core/services/arena.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/core/services/arena.service')>();

  return {
    ...actual,
    arenaService: {
      listActiveChallenges: vi.fn(),
      getChallenge: vi.fn(),
      joinChallenge: vi.fn(),
      submitProof: vi.fn(),
      listLeaderboard: vi.fn(),
    },
  };
});

vi.mock('@/infra/integrations/steam/steam.service', () => ({ steamService: {} }));
vi.mock('@/infra/integrations/igdb/igdb.service', () => ({ igdbService: {} }));
vi.mock('@/infra/integrations/epic/epic.service', () => ({ epicService: {} }));

const challenge = {
  id: 'challenge-id-1',
  slug: 'semana-da-game-session',
  title: 'Semana da Game Session',
  description: 'Envie GAME_SESSION da semana.',
  startsAt: new Date('2026-05-01T00:00:00.000Z'),
  endsAt: new Date('2026-05-08T00:00:00.000Z'),
  status: ArenaChallengeStatus.ACTIVE,
  ruleType: ArenaProofType.GAME_SESSION,
  scoreValue: 10,
  maxSubmissionsPerUser: 3,
  participantCount: 1,
  submissionCount: 0,
  viewerHasJoined: false,
  viewerJoinedAt: null,
  createdAt: new Date('2026-05-01T00:00:00.000Z'),
  updatedAt: new Date('2026-05-01T00:00:00.000Z'),
};

describe('Arena Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lista desafios ativos', async () => {
    vi.mocked(arenaService.listActiveChallenges).mockResolvedValue([challenge]);

    const app = await buildApp();
    const response = await app.inject({ method: 'GET', url: '/arena/challenges' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      challenges: [
        {
          slug: 'semana-da-game-session',
          scoreValue: 10,
          maxSubmissionsPerUser: 3,
        },
      ],
    });
    await app.close();
  });

  it('retorna detalhe do desafio por slug', async () => {
    vi.mocked(arenaService.getChallenge).mockResolvedValue(challenge);

    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/arena/challenges/semana-da-game-session',
    });

    expect(response.statusCode).toBe(200);
    expect(arenaService.getChallenge).toHaveBeenCalledWith(
      'semana-da-game-session',
      null,
    );
    await app.close();
  });

  it('entra em desafio autenticado', async () => {
    vi.mocked(arenaService.joinChallenge).mockResolvedValue({
      ...challenge,
      viewerHasJoined: true,
      viewerJoinedAt: new Date('2026-05-01T10:00:00.000Z'),
    });

    const app = await buildApp();
    const token = generateTestToken(app, 'user-id-1');
    const response = await app.inject({
      method: 'POST',
      url: '/arena/challenges/challenge-id-1/join',
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    expect(arenaService.joinChallenge).toHaveBeenCalledWith(
      'challenge-id-1',
      'user-id-1',
    );
    await app.close();
  });

  it('bloqueia entrada sem autenticacao', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/arena/challenges/challenge-id-1/join',
    });

    expect(response.statusCode).toBe(401);
    expect(arenaService.joinChallenge).not.toHaveBeenCalled();
    await app.close();
  });

  it('submete prova valida', async () => {
    vi.mocked(arenaService.submitProof).mockResolvedValue({
      id: 'submission-id-1',
      challengeId: 'challenge-id-1',
      userId: 'user-id-1',
      proofType: ArenaProofType.GAME_SESSION,
      proofId: 'post-id-1',
      score: 10,
      submittedAt: new Date('2026-05-01T12:00:00.000Z'),
    });

    const app = await buildApp();
    const token = generateTestToken(app, 'user-id-1');
    const response = await app.inject({
      method: 'POST',
      url: '/arena/challenges/challenge-id-1/submissions',
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        proofType: 'GAME_SESSION',
        proofId: 'post-id-1',
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      submission: {
        proofType: 'GAME_SESSION',
        proofId: 'post-id-1',
        score: 10,
      },
    });
    await app.close();
  });

  it('rejeita proofType invalido antes do service', async () => {
    const app = await buildApp();
    const token = generateTestToken(app, 'user-id-1');
    const response = await app.inject({
      method: 'POST',
      url: '/arena/challenges/challenge-id-1/submissions',
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        proofType: 'COMMENT',
        proofId: 'comment-id-1',
      },
    });

    expect(response.statusCode).toBe(400);
    expect(arenaService.submitProof).not.toHaveBeenCalled();
    await app.close();
  });

  it('mapeia erro de dominio sem virar 500', async () => {
    vi.mocked(arenaService.submitProof).mockRejectedValue(
      new ArenaServiceError(
        'ARENA_PROOF_DUPLICATE',
        'Esta prova já foi usada neste desafio.',
      ),
    );

    const app = await buildApp();
    const token = generateTestToken(app, 'user-id-1');
    const response = await app.inject({
      method: 'POST',
      url: '/arena/challenges/challenge-id-1/submissions',
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        proofType: 'GAME_SESSION',
        proofId: 'post-id-1',
      },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      message: 'Esta prova já foi usada neste desafio.',
    });
    await app.close();
  });

  it('retorna ranking local do desafio', async () => {
    vi.mocked(arenaService.listLeaderboard).mockResolvedValue([
      {
        position: 1,
        userId: 'user-id-1',
        username: 'clutchplayer',
        displayName: 'Clutch Player',
        score: 20,
        submissionsCount: 2,
        lastSubmissionAt: new Date('2026-05-01T12:00:00.000Z'),
      },
    ]);

    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/arena/challenges/challenge-id-1/leaderboard',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      leaderboard: [
        {
          position: 1,
          username: 'clutchplayer',
          score: 20,
        },
      ],
    });
    await app.close();
  });
});
