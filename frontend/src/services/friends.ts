import { apiRequest } from '@/lib/api';
import {
  createFriendRequestResponseSchema,
  friendActionResponseSchema,
  friendsResponseSchema,
  pendingFriendRequestsResponseSchema,
  type CreateFriendRequestResponse,
  type FriendSummary,
  type PendingFriendRequest,
} from '@/schemas/friends';

type ErrorResponse = {
  message?: string;
};

export class FriendsRequestError extends Error {
  public readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'FriendsRequestError';
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

export async function fetchFriends(userId: string): Promise<FriendSummary[]> {
  const response = await apiRequest(`/friends/${encodeURIComponent(userId)}`, {
    method: 'GET',
  });
  const payload = await readJson(response);

  if (!response.ok) {
    throw new FriendsRequestError(
      response.status,
      resolveErrorMessage(payload, 'Nao foi possivel carregar a lista de amigos.'),
    );
  }

  return friendsResponseSchema.parse(payload);
}

export async function fetchPendingFriendRequests(
  userId: string,
): Promise<PendingFriendRequest[]> {
  const response = await apiRequest(
    `/friends/requests/${encodeURIComponent(userId)}`,
    {
      method: 'GET',
    },
  );
  const payload = await readJson(response);

  if (!response.ok) {
    throw new FriendsRequestError(
      response.status,
      resolveErrorMessage(payload, 'Nao foi possivel carregar os pedidos pendentes.'),
    );
  }

  return pendingFriendRequestsResponseSchema.parse(payload);
}

export async function sendFriendRequest(
  targetId: string,
): Promise<CreateFriendRequestResponse> {
  const response = await apiRequest(
    `/friends/request/${encodeURIComponent(targetId)}`,
    {
      method: 'POST',
    },
  );
  const payload = await readJson(response);

  if (!response.ok) {
    throw new FriendsRequestError(
      response.status,
      resolveErrorMessage(payload, 'Nao foi possivel enviar o pedido agora.'),
    );
  }

  return createFriendRequestResponseSchema.parse(payload);
}

export async function acceptFriendRequest(requestId: string): Promise<void> {
  const response = await apiRequest(
    `/friends/accept/${encodeURIComponent(requestId)}`,
    {
      method: 'POST',
    },
  );
  const payload = await readJson(response);

  if (!response.ok) {
    throw new FriendsRequestError(
      response.status,
      resolveErrorMessage(payload, 'Nao foi possivel aceitar o pedido agora.'),
    );
  }

  friendActionResponseSchema.parse(payload);
}

export async function removeFriend(friendId: string): Promise<void> {
  const response = await apiRequest(`/friends/${encodeURIComponent(friendId)}`, {
    method: 'DELETE',
  });
  const payload = await readJson(response);

  if (!response.ok) {
    throw new FriendsRequestError(
      response.status,
      resolveErrorMessage(payload, 'Nao foi possivel remover a amizade agora.'),
    );
  }

  friendActionResponseSchema.parse(payload);
}
