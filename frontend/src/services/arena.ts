import { apiRequest } from '@/lib/api';
import {
  arenaChallengeResponseSchema,
  arenaChallengesResponseSchema,
  arenaLeaderboardResponseSchema,
  arenaSubmissionResponseSchema,
  submitArenaProofRequestSchema,
  type ArenaChallenge,
  type ArenaLeaderboardEntry,
  type ArenaSubmission,
  type SubmitArenaProofValues,
} from '@/schemas/arena';

type ErrorResponse = {
  message?: string;
};

export class ArenaRequestError extends Error {
  public readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ArenaRequestError';
    this.status = status;
  }
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();

  if (text.length === 0) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function resolveErrorMessage(payload: unknown, fallback: string): string {
  if (typeof payload === 'object' && payload !== null && 'message' in payload) {
    const message = (payload as ErrorResponse).message;

    if (typeof message === 'string' && message.length > 0) {
      return message;
    }
  }

  return fallback;
}

export async function fetchArenaChallenges(): Promise<ArenaChallenge[]> {
  const response = await apiRequest('/arena/challenges', {
    method: 'GET',
  });
  const payload = await readJson(response);

  if (!response.ok) {
    throw new ArenaRequestError(
      response.status,
      resolveErrorMessage(payload, 'Nao foi possivel carregar os desafios Arena.'),
    );
  }

  return arenaChallengesResponseSchema.parse(payload).challenges;
}

export async function fetchArenaChallenge(slug: string): Promise<ArenaChallenge> {
  const response = await apiRequest(`/arena/challenges/${encodeURIComponent(slug)}`, {
    method: 'GET',
  });
  const payload = await readJson(response);

  if (!response.ok) {
    throw new ArenaRequestError(
      response.status,
      resolveErrorMessage(payload, 'Nao foi possivel carregar este desafio Arena.'),
    );
  }

  return arenaChallengeResponseSchema.parse(payload).challenge;
}

export async function joinArenaChallenge(challengeId: string): Promise<ArenaChallenge> {
  const response = await apiRequest(`/arena/challenges/${encodeURIComponent(challengeId)}/join`, {
    method: 'POST',
  });
  const payload = await readJson(response);

  if (!response.ok) {
    throw new ArenaRequestError(
      response.status,
      resolveErrorMessage(payload, 'Nao foi possivel entrar neste desafio Arena.'),
    );
  }

  return arenaChallengeResponseSchema.parse(payload).challenge;
}

export async function submitArenaProof(
  challengeId: string,
  input: SubmitArenaProofValues,
): Promise<ArenaSubmission> {
  const payload = submitArenaProofRequestSchema.parse(input);
  const response = await apiRequest(
    `/arena/challenges/${encodeURIComponent(challengeId)}/submissions`,
    {
      method: 'POST',
      body: payload,
    },
  );
  const responsePayload = await readJson(response);

  if (!response.ok) {
    throw new ArenaRequestError(
      response.status,
      resolveErrorMessage(responsePayload, 'Nao foi possivel submeter esta prova.'),
    );
  }

  return arenaSubmissionResponseSchema.parse(responsePayload).submission;
}

export async function fetchArenaLeaderboard(
  challengeId: string,
): Promise<ArenaLeaderboardEntry[]> {
  const response = await apiRequest(
    `/arena/challenges/${encodeURIComponent(challengeId)}/leaderboard`,
    {
      method: 'GET',
    },
  );
  const payload = await readJson(response);

  if (!response.ok) {
    throw new ArenaRequestError(
      response.status,
      resolveErrorMessage(payload, 'Nao foi possivel carregar o ranking local.'),
    );
  }

  return arenaLeaderboardResponseSchema.parse(payload).leaderboard;
}
