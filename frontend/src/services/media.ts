import { apiRequest } from '@/lib/api';
import {
  uploadedImageResponseSchema,
  type UploadedImageResponse,
} from '@/schemas/media';

type ErrorResponse = {
  message?: string;
};

export class MediaUploadRequestError extends Error {
  public readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'MediaUploadRequestError';
    this.status = status;
  }
}

export async function uploadImage(file: File): Promise<UploadedImageResponse> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await apiRequest('/uploads/images', {
    method: 'POST',
    body: formData,
  });
  const payload = await readJson(response);

  if (!response.ok) {
    throw new MediaUploadRequestError(
      response.status,
      resolveErrorMessage(payload, 'Nao foi possivel enviar a imagem agora.'),
    );
  }

  const parsedPayload = uploadedImageResponseSchema.parse(payload);

  return {
    ...parsedPayload,
    url: resolveUploadedImageUrl(parsedPayload.url),
  };
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

function resolveUploadedImageUrl(url: string): string {
  if (typeof window === 'undefined') {
    return url;
  }

  try {
    return new URL(url, window.location.origin).toString();
  } catch {
    return url;
  }
}
