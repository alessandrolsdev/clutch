import { apiRequest } from '@/lib/api';
import {
  communitiesResponseSchema,
  communityResponseSchema,
  createCommunityRequestSchema,
  type Community,
  type CreateCommunityValues,
} from '@/schemas/communities';

type ErrorResponse = {
  message?: string;
};

export class CommunitiesRequestError extends Error {
  public readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'CommunitiesRequestError';
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

export async function fetchCommunities(): Promise<Community[]> {
  const response = await apiRequest('/communities', {
    method: 'GET',
  });
  const payload = await readJson(response);

  if (!response.ok) {
    throw new CommunitiesRequestError(
      response.status,
      resolveErrorMessage(payload, 'Nao foi possivel carregar as comunidades.'),
    );
  }

  return communitiesResponseSchema.parse(payload).communities;
}

export async function fetchCommunityBySlug(slug: string): Promise<Community> {
  const response = await apiRequest(`/communities/${encodeURIComponent(slug)}`, {
    method: 'GET',
  });
  const payload = await readJson(response);

  if (!response.ok) {
    throw new CommunitiesRequestError(
      response.status,
      resolveErrorMessage(payload, 'Nao foi possivel carregar esta comunidade.'),
    );
  }

  return communityResponseSchema.parse(payload).community;
}

export async function createCommunity(input: CreateCommunityValues): Promise<Community> {
  const payload = createCommunityRequestSchema.parse(input);
  const normalizedPayload = {
    name: payload.name.trim(),
    description: payload.description?.trim() || undefined,
  };

  const response = await apiRequest('/communities', {
    method: 'POST',
    body: normalizedPayload,
  });
  const responsePayload = await readJson(response);

  if (!response.ok) {
    throw new CommunitiesRequestError(
      response.status,
      resolveErrorMessage(responsePayload, 'Nao foi possivel criar a comunidade.'),
    );
  }

  return communityResponseSchema.parse(responsePayload).community;
}

export async function joinCommunity(slug: string): Promise<Community> {
  const response = await apiRequest(`/communities/${encodeURIComponent(slug)}/join`, {
    method: 'POST',
  });
  const payload = await readJson(response);

  if (!response.ok) {
    throw new CommunitiesRequestError(
      response.status,
      resolveErrorMessage(payload, 'Nao foi possivel participar desta comunidade.'),
    );
  }

  return communityResponseSchema.parse(payload).community;
}

export async function leaveCommunity(slug: string): Promise<Community> {
  const response = await apiRequest(`/communities/${encodeURIComponent(slug)}/membership`, {
    method: 'DELETE',
  });
  const payload = await readJson(response);

  if (!response.ok) {
    throw new CommunitiesRequestError(
      response.status,
      resolveErrorMessage(payload, 'Nao foi possivel sair desta comunidade.'),
    );
  }

  return communityResponseSchema.parse(payload).community;
}

export async function archiveCommunity(slug: string): Promise<Community> {
  const response = await apiRequest(`/communities/${encodeURIComponent(slug)}/archive`, {
    method: 'PATCH',
  });
  const payload = await readJson(response);

  if (!response.ok) {
    throw new CommunitiesRequestError(
      response.status,
      resolveErrorMessage(payload, 'Nao foi possivel arquivar esta comunidade.'),
    );
  }

  return communityResponseSchema.parse(payload).community;
}
