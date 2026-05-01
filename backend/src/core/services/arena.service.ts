import {
  ArenaChallengeStatus,
  ArenaProofType,
  PostType,
  Prisma,
} from '@prisma/client';
import {
  arenaRepository,
  type ArenaChallengeSummary,
  type ArenaLeaderboardEntry,
  type ArenaSubmissionSummary,
} from '../repositories/arena.repository';

const POST_PROOF_TYPES = new Set<ArenaProofType>([
  ArenaProofType.GAME_SESSION,
  ArenaProofType.ACHIEVEMENT,
]);

export type ArenaServiceErrorCode =
  | 'ARENA_CHALLENGE_NOT_FOUND'
  | 'ARENA_CHALLENGE_NOT_ACTIVE'
  | 'ARENA_CHALLENGE_NOT_STARTED'
  | 'ARENA_CHALLENGE_ENDED'
  | 'ARENA_PARTICIPATION_REQUIRED'
  | 'ARENA_PROOF_NOT_FOUND'
  | 'ARENA_PROOF_FORBIDDEN'
  | 'ARENA_PROOF_TYPE_UNSUPPORTED'
  | 'ARENA_PROOF_OUTSIDE_WINDOW'
  | 'ARENA_PROOF_DUPLICATE'
  | 'ARENA_SUBMISSION_CAP_REACHED';

export class ArenaServiceError extends Error {
  readonly code: ArenaServiceErrorCode;

  constructor(code: ArenaServiceErrorCode, message: string) {
    super(message);
    this.name = 'ArenaServiceError';
    this.code = code;
  }
}

export type CreateArenaSubmissionInput = {
  proofType: ArenaProofType;
  proofId: string;
};

function assertChallengeAcceptsActions(
  challenge: ArenaChallengeSummary,
  now: Date,
): void {
  if (challenge.status !== ArenaChallengeStatus.ACTIVE) {
    throw new ArenaServiceError(
      'ARENA_CHALLENGE_NOT_ACTIVE',
      'Este desafio Arena não está ativo.',
    );
  }

  if (challenge.startsAt > now) {
    throw new ArenaServiceError(
      'ARENA_CHALLENGE_NOT_STARTED',
      'Este desafio Arena ainda não começou.',
    );
  }

  if (challenge.endsAt <= now) {
    throw new ArenaServiceError(
      'ARENA_CHALLENGE_ENDED',
      'Este desafio Arena já encerrou.',
    );
  }
}

function toExpectedPostType(proofType: ArenaProofType): PostType {
  if (proofType === ArenaProofType.GAME_SESSION) {
    return PostType.GAME_SESSION;
  }

  if (proofType === ArenaProofType.ACHIEVEMENT) {
    return PostType.ACHIEVEMENT;
  }

  throw new ArenaServiceError(
    'ARENA_PROOF_TYPE_UNSUPPORTED',
    'Este tipo de prova ainda não é aceito no MVP do Arena.',
  );
}

function assertProofBelongsToChallengeWindow(
  proofCreatedAt: Date,
  challenge: ArenaChallengeSummary,
): void {
  if (proofCreatedAt < challenge.startsAt || proofCreatedAt > challenge.endsAt) {
    throw new ArenaServiceError(
      'ARENA_PROOF_OUTSIDE_WINDOW',
      'A prova precisa estar dentro da janela do desafio.',
    );
  }
}

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

export const arenaService = {
  async listActiveChallenges(viewerUserId?: string | null): Promise<ArenaChallengeSummary[]> {
    return arenaRepository.listActiveChallenges(new Date(), viewerUserId);
  },

  async getChallenge(
    slug: string,
    viewerUserId?: string | null,
  ): Promise<ArenaChallengeSummary> {
    const challenge = await arenaRepository.findChallengeBySlug(slug, viewerUserId);

    if (!challenge) {
      throw new ArenaServiceError(
        'ARENA_CHALLENGE_NOT_FOUND',
        'Desafio Arena não encontrado.',
      );
    }

    return challenge;
  },

  async joinChallenge(
    challengeId: string,
    userId: string,
  ): Promise<ArenaChallengeSummary> {
    const now = new Date();
    const challenge = await arenaRepository.findChallengeById(challengeId, userId);

    if (!challenge) {
      throw new ArenaServiceError(
        'ARENA_CHALLENGE_NOT_FOUND',
        'Desafio Arena não encontrado.',
      );
    }

    assertChallengeAcceptsActions(challenge, now);
    await arenaRepository.upsertParticipation(challenge.id, userId);

    const updatedChallenge = await arenaRepository.findChallengeById(challengeId, userId);
    if (!updatedChallenge) {
      throw new ArenaServiceError(
        'ARENA_CHALLENGE_NOT_FOUND',
        'Desafio Arena não encontrado.',
      );
    }

    return updatedChallenge;
  },

  async submitProof(
    challengeId: string,
    userId: string,
    input: CreateArenaSubmissionInput,
  ): Promise<ArenaSubmissionSummary> {
    const now = new Date();
    const challenge = await arenaRepository.findChallengeById(challengeId, userId);

    if (!challenge) {
      throw new ArenaServiceError(
        'ARENA_CHALLENGE_NOT_FOUND',
        'Desafio Arena não encontrado.',
      );
    }

    assertChallengeAcceptsActions(challenge, now);

    if (!POST_PROOF_TYPES.has(input.proofType) || input.proofType !== challenge.ruleType) {
      throw new ArenaServiceError(
        'ARENA_PROOF_TYPE_UNSUPPORTED',
        'Este desafio não aceita esse tipo de prova.',
      );
    }

    const participation = await arenaRepository.findParticipation(challenge.id, userId);
    if (!participation) {
      throw new ArenaServiceError(
        'ARENA_PARTICIPATION_REQUIRED',
        'Entre no desafio antes de submeter uma prova.',
      );
    }

    const proofPost = await arenaRepository.findProofPost(input.proofId);
    if (!proofPost) {
      throw new ArenaServiceError(
        'ARENA_PROOF_NOT_FOUND',
        'Prova elegível não encontrada.',
      );
    }

    if (proofPost.userId !== userId) {
      throw new ArenaServiceError(
        'ARENA_PROOF_FORBIDDEN',
        'Você só pode submeter provas da sua própria atividade.',
      );
    }

    const expectedPostType = toExpectedPostType(input.proofType);
    if (proofPost.type !== expectedPostType) {
      throw new ArenaServiceError(
        'ARENA_PROOF_TYPE_UNSUPPORTED',
        'Presence, reactions, comments e posts comuns não contam como prova Arena.',
      );
    }

    assertProofBelongsToChallengeWindow(proofPost.createdAt, challenge);

    const existingSubmission = await arenaRepository.findSubmissionByProof(
      challenge.id,
      input.proofType,
      input.proofId,
    );

    if (existingSubmission) {
      throw new ArenaServiceError(
        'ARENA_PROOF_DUPLICATE',
        'Esta prova já foi usada neste desafio.',
      );
    }

    const submissionsCount = await arenaRepository.countUserSubmissions(challenge.id, userId);
    if (submissionsCount >= challenge.maxSubmissionsPerUser) {
      throw new ArenaServiceError(
        'ARENA_SUBMISSION_CAP_REACHED',
        'Você atingiu o limite de submissões deste desafio.',
      );
    }

    try {
      return await arenaRepository.createSubmission({
        challengeId: challenge.id,
        participationId: participation.id,
        userId,
        proofType: input.proofType,
        proofId: input.proofId,
        score: challenge.scoreValue,
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ArenaServiceError(
          'ARENA_PROOF_DUPLICATE',
          'Esta prova já foi usada neste desafio.',
        );
      }

      throw error;
    }
  },

  async listLeaderboard(challengeId: string): Promise<ArenaLeaderboardEntry[]> {
    const challenge = await arenaRepository.findChallengeById(challengeId);

    if (!challenge) {
      throw new ArenaServiceError(
        'ARENA_CHALLENGE_NOT_FOUND',
        'Desafio Arena não encontrado.',
      );
    }

    return arenaRepository.listLeaderboard(challenge.id);
  },
};
