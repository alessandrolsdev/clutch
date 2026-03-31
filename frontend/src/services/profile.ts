import { apiRequest } from '@/lib/api';
import {
  profileResponseSchema,
  profileUpdateRequestSchema,
  profileUpdateResponseSchema,
  type ProfileResponse,
  type ProfileUpdateResponse,
  type ProfileUpdateValues,
} from '@/schemas/profile';

type ErrorResponse = {
  message?: string;
};

export class ProfileRequestError extends Error {
  public readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ProfileRequestError';
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

export async function fetchProfileByUsername(
  username: string,
): Promise<ProfileResponse> {
  const response = await apiRequest(`/profiles/${encodeURIComponent(username)}`, {
    method: 'GET',
  });

  const payload = await readJson(response);

  if (!response.ok) {
    const fallbackMessage =
      response.status === 404
        ? 'Perfil nao encontrado.'
        : 'Nao foi possivel carregar o perfil agora.';

    throw new ProfileRequestError(
      response.status,
      resolveErrorMessage(payload, fallbackMessage),
    );
  }

  return profileResponseSchema.parse(payload);
}

export async function updateProfileByUsername(
  username: string,
  input: ProfileUpdateValues,
): Promise<ProfileUpdateResponse> {
  const payload = profileUpdateRequestSchema.parse(input);
  const normalizedPayload = {
    displayName: payload.displayName.trim(),
    bio: payload.bio.trim(),
    avatarUrl: payload.avatarUrl.trim() || undefined,
    bannerUrl: payload.bannerUrl.trim() || undefined,
    accentColor: payload.accentColor.trim(),
  };

  const response = await apiRequest(`/profiles/${encodeURIComponent(username)}`, {
    method: 'PATCH',
    body: normalizedPayload,
  });

  const responsePayload = await readJson(response);

  if (!response.ok) {
    throw new ProfileRequestError(
      response.status,
      resolveErrorMessage(responsePayload, 'Nao foi possivel atualizar o perfil agora.'),
    );
  }

  return profileUpdateResponseSchema.parse(responsePayload);
}
