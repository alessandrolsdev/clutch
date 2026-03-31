import { apiRequest } from '@/lib/api';
import {
  createPostRequestSchema,
  createPostResponseSchema,
  feedResponseSchema,
  type CreatePostRequest,
  type CreatePostResponse,
  type FeedResponse,
} from '@/schemas/feed';

type ErrorResponse = {
  message?: string;
};

type FeedRequestInput = {
  userId: string;
  cursor?: string;
  limit?: number;
};

export class FeedRequestError extends Error {
  public readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'FeedRequestError';
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

export async function fetchFeed(input: FeedRequestInput): Promise<FeedResponse> {
  const searchParams = new URLSearchParams();

  if (input.cursor) {
    searchParams.set('cursor', input.cursor);
  }

  if (typeof input.limit === 'number') {
    searchParams.set('limit', String(input.limit));
  }

  const path = `/posts/feed/${encodeURIComponent(input.userId)}${
    searchParams.size > 0 ? `?${searchParams.toString()}` : ''
  }`;

  const response = await apiRequest(path, { method: 'GET' });
  const payload = await readJson(response);

  if (!response.ok) {
    throw new FeedRequestError(
      response.status,
      resolveErrorMessage(payload, 'Nao foi possivel carregar o feed agora.'),
    );
  }

  return feedResponseSchema.parse(payload);
}

export async function createPost(
  input: CreatePostRequest,
): Promise<CreatePostResponse> {
  const payload = createPostRequestSchema.parse(input);
  const normalizedPayload = {
    contentText: payload.contentText.trim() || undefined,
    mediaUrl: payload.mediaUrl.trim() || undefined,
    type: payload.type,
  };

  const response = await apiRequest('/posts', {
    method: 'POST',
    body: normalizedPayload,
  });
  const responsePayload = await readJson(response);

  if (!response.ok) {
    throw new FeedRequestError(
      response.status,
      resolveErrorMessage(responsePayload, 'Nao foi possivel publicar agora.'),
    );
  }

  return createPostResponseSchema.parse(responsePayload);
}
