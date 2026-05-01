import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ArenaChallengeStatus,
  ArenaProofType,
  PostType,
} from '@prisma/client';
import { arenaService } from '@/core/services/arena.service';
import {
  arenaRepository,
  type ArenaChallengeSummary,
  type ArenaSubmissionSummary,
} from '@/core/repositories/arena.repository';

vi.mock('@/core/repositories/arena.repository', () => ({
  arenaRepository: {
    listActiveChallenges: vi.fn(),
    findChallengeBySlug: vi.fn(),
    findChallengeById: vi.fn(),
    upsertParticipation: vi.fn(),
    findParticipation: vi.fn(),
    findProofPost: vi.fn(),
    countUserSubmissions: vi.fn(),
    findSubmissionByProof: vi.fn(),
    createSubmission: vi.fn(),
    listLeaderboard: vi.fn(),
  },
}));

const activeChallenge: ArenaChallengeSummary = {
  id: 'challenge-id-1',
  slug: 'semana-da-game-session',
  title: 'Semana da Game Session',
  description: 'Envie GAME_SESSION da semana.',
  startsAt: new Date('2020-01-01T00:00:00.000Z'),
  endsAt: new Date('2099-01-01T00:00:00.000Z'),
  status: ArenaChallengeStatus.ACTIVE,
  ruleType: ArenaProofType.GAME_SESSION,
  scoreValue: 10,
  maxSubmissionsPerUser: 3,
  participantCount: 0,
  submissionCount: 0,
  viewerHasJoined: false,
  viewerJoinedAt: null,
  createdAt: new Date('2026-05-01T10:00:00.000Z'),
  updatedAt: new Date('2026-05-01T10:00:00.000Z'),
};

const submission: ArenaSubmissionSummary = {
  id: 'submission-id-1',
  challengeId: activeChallenge.id,
  userId: 'user-id-1',
  proofType: ArenaProofType.GAME_SESSION,
  proofId: 'post-id-1',
  score: 10,
  submittedAt: new Date('2026-05-01T11:00:00.000Z'),
};

describe('arenaService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(arenaRepository.findChallengeById).mockResolvedValue(activeChallenge);
  });

  it('lista desafios ativos com contexto do viewer', async () => {
    vi.mocked(arenaRepository.listActiveChallenges).mockResolvedValue([activeChallenge]);

    const result = await arenaService.listActiveChallenges('user-id-1');

    expect(result).toEqual([activeChallenge]);
    expect(arenaRepository.listActiveChallenges).toHaveBeenCalledWith(
      expect.any(Date),
      'user-id-1',
    );
  });

  it('permite entrar em desafio ativo de forma idempotente', async () => {
    vi.mocked(arenaRepository.upsertParticipation).mockResolvedValue({
      id: 'participation-id-1',
      challengeId: activeChallenge.id,
      userId: 'user-id-1',
      joinedAt: new Date('2026-05-01T10:30:00.000Z'),
    });
    vi.mocked(arenaRepository.findChallengeById)
      .mockResolvedValueOnce(activeChallenge)
      .mockResolvedValueOnce({
        ...activeChallenge,
        participantCount: 1,
        viewerHasJoined: true,
        viewerJoinedAt: new Date('2026-05-01T10:30:00.000Z'),
      });

    const result = await arenaService.joinChallenge(activeChallenge.id, 'user-id-1');

    expect(arenaRepository.upsertParticipation).toHaveBeenCalledWith(
      activeChallenge.id,
      'user-id-1',
    );
    expect(result.viewerHasJoined).toBe(true);
  });

  it('bloqueia entrada em desafio encerrado', async () => {
    vi.mocked(arenaRepository.findChallengeById).mockResolvedValue({
      ...activeChallenge,
      endsAt: new Date('2020-01-02T00:00:00.000Z'),
    });

    await expect(
      arenaService.joinChallenge(activeChallenge.id, 'user-id-1'),
    ).rejects.toMatchObject({
      code: 'ARENA_CHALLENGE_ENDED',
    });
    expect(arenaRepository.upsertParticipation).not.toHaveBeenCalled();
  });

  it('submete prova GAME_SESSION valida e calcula score fixo', async () => {
    vi.mocked(arenaRepository.findParticipation).mockResolvedValue({
      id: 'participation-id-1',
      challengeId: activeChallenge.id,
      userId: 'user-id-1',
      joinedAt: new Date('2026-05-01T10:30:00.000Z'),
    });
    vi.mocked(arenaRepository.findProofPost).mockResolvedValue({
      id: 'post-id-1',
      userId: 'user-id-1',
      type: PostType.GAME_SESSION,
      createdAt: new Date('2026-05-01T11:00:00.000Z'),
      contentText: 'Ranked com squad fechado.',
    });
    vi.mocked(arenaRepository.findSubmissionByProof).mockResolvedValue(null);
    vi.mocked(arenaRepository.countUserSubmissions).mockResolvedValue(0);
    vi.mocked(arenaRepository.createSubmission).mockResolvedValue(submission);

    const result = await arenaService.submitProof(activeChallenge.id, 'user-id-1', {
      proofType: ArenaProofType.GAME_SESSION,
      proofId: 'post-id-1',
    });

    expect(result.score).toBe(10);
    expect(arenaRepository.createSubmission).toHaveBeenCalledWith({
      challengeId: activeChallenge.id,
      participationId: 'participation-id-1',
      userId: 'user-id-1',
      proofType: ArenaProofType.GAME_SESSION,
      proofId: 'post-id-1',
      score: 10,
    });
  });

  it('bloqueia submissao sem participacao voluntaria', async () => {
    vi.mocked(arenaRepository.findParticipation).mockResolvedValue(null);

    await expect(
      arenaService.submitProof(activeChallenge.id, 'user-id-1', {
        proofType: ArenaProofType.GAME_SESSION,
        proofId: 'post-id-1',
      }),
    ).rejects.toMatchObject({
      code: 'ARENA_PARTICIPATION_REQUIRED',
    });
  });

  it('bloqueia prova de outro usuario', async () => {
    vi.mocked(arenaRepository.findParticipation).mockResolvedValue({
      id: 'participation-id-1',
      challengeId: activeChallenge.id,
      userId: 'user-id-1',
      joinedAt: new Date(),
    });
    vi.mocked(arenaRepository.findProofPost).mockResolvedValue({
      id: 'post-id-1',
      userId: 'other-user-id',
      type: PostType.GAME_SESSION,
      createdAt: new Date('2026-05-01T11:00:00.000Z'),
      contentText: null,
    });

    await expect(
      arenaService.submitProof(activeChallenge.id, 'user-id-1', {
        proofType: ArenaProofType.GAME_SESSION,
        proofId: 'post-id-1',
      }),
    ).rejects.toMatchObject({
      code: 'ARENA_PROOF_FORBIDDEN',
    });
  });

  it('bloqueia posts comuns, reactions, comments e presence como prova', async () => {
    vi.mocked(arenaRepository.findParticipation).mockResolvedValue({
      id: 'participation-id-1',
      challengeId: activeChallenge.id,
      userId: 'user-id-1',
      joinedAt: new Date(),
    });
    vi.mocked(arenaRepository.findProofPost).mockResolvedValue({
      id: 'post-id-1',
      userId: 'user-id-1',
      type: PostType.TEXT,
      createdAt: new Date('2026-05-01T11:00:00.000Z'),
      contentText: 'comentario social nao pontua',
    });

    await expect(
      arenaService.submitProof(activeChallenge.id, 'user-id-1', {
        proofType: ArenaProofType.GAME_SESSION,
        proofId: 'post-id-1',
      }),
    ).rejects.toMatchObject({
      code: 'ARENA_PROOF_TYPE_UNSUPPORTED',
    });
  });

  it('bloqueia prova duplicada no mesmo desafio', async () => {
    vi.mocked(arenaRepository.findParticipation).mockResolvedValue({
      id: 'participation-id-1',
      challengeId: activeChallenge.id,
      userId: 'user-id-1',
      joinedAt: new Date(),
    });
    vi.mocked(arenaRepository.findProofPost).mockResolvedValue({
      id: 'post-id-1',
      userId: 'user-id-1',
      type: PostType.GAME_SESSION,
      createdAt: new Date('2026-05-01T11:00:00.000Z'),
      contentText: null,
    });
    vi.mocked(arenaRepository.findSubmissionByProof).mockResolvedValue(submission);

    await expect(
      arenaService.submitProof(activeChallenge.id, 'user-id-1', {
        proofType: ArenaProofType.GAME_SESSION,
        proofId: 'post-id-1',
      }),
    ).rejects.toMatchObject({
      code: 'ARENA_PROOF_DUPLICATE',
    });
  });

  it('bloqueia submissao acima do cap do desafio', async () => {
    vi.mocked(arenaRepository.findParticipation).mockResolvedValue({
      id: 'participation-id-1',
      challengeId: activeChallenge.id,
      userId: 'user-id-1',
      joinedAt: new Date(),
    });
    vi.mocked(arenaRepository.findProofPost).mockResolvedValue({
      id: 'post-id-1',
      userId: 'user-id-1',
      type: PostType.GAME_SESSION,
      createdAt: new Date('2026-05-01T11:00:00.000Z'),
      contentText: null,
    });
    vi.mocked(arenaRepository.findSubmissionByProof).mockResolvedValue(null);
    vi.mocked(arenaRepository.countUserSubmissions).mockResolvedValue(3);

    await expect(
      arenaService.submitProof(activeChallenge.id, 'user-id-1', {
        proofType: ArenaProofType.GAME_SESSION,
        proofId: 'post-id-1',
      }),
    ).rejects.toMatchObject({
      code: 'ARENA_SUBMISSION_CAP_REACHED',
    });
  });

  it('bloqueia prova fora da janela do desafio', async () => {
    vi.mocked(arenaRepository.findParticipation).mockResolvedValue({
      id: 'participation-id-1',
      challengeId: activeChallenge.id,
      userId: 'user-id-1',
      joinedAt: new Date(),
    });
    vi.mocked(arenaRepository.findProofPost).mockResolvedValue({
      id: 'post-id-1',
      userId: 'user-id-1',
      type: PostType.GAME_SESSION,
      createdAt: new Date('2019-01-01T11:00:00.000Z'),
      contentText: null,
    });

    await expect(
      arenaService.submitProof(activeChallenge.id, 'user-id-1', {
        proofType: ArenaProofType.GAME_SESSION,
        proofId: 'post-id-1',
      }),
    ).rejects.toMatchObject({
      code: 'ARENA_PROOF_OUTSIDE_WINDOW',
    });
  });

  it('retorna ranking local do desafio', async () => {
    vi.mocked(arenaRepository.listLeaderboard).mockResolvedValue([
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

    const result = await arenaService.listLeaderboard(activeChallenge.id);

    expect(result[0]?.position).toBe(1);
    expect(arenaRepository.listLeaderboard).toHaveBeenCalledWith(activeChallenge.id);
  });
});
