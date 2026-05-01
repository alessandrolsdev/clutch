import { apiRequest } from '@/lib/api';
import {
  otakuLibraryResponseSchema,
  otakuShowcaseUpdateRequestSchema,
  otakuShowcaseUpdateResponseSchema,
  type OtakuLibraryResponse,
  type OtakuShowcaseUpdateResponse,
  type OtakuShowcaseUpdateValues,
} from '@/schemas/otaku';

type ErrorResponse = {
  message?: string;
};

export class OtakuRequestError extends Error {
  public readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'OtakuRequestError';
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

export async function fetchOtakuLibrary(): Promise<OtakuLibraryResponse> {
  const response = await apiRequest('/otaku/library', {
    method: 'GET',
  });
  const responsePayload = await readJson(response);

  if (!response.ok) {
    throw new OtakuRequestError(
      response.status,
      resolveErrorMessage(responsePayload, 'Nao foi possivel carregar a biblioteca otaku agora.'),
    );
  }

  return otakuLibraryResponseSchema.parse(responsePayload);
}

export async function updateOtakuShowcaseEntry(
  entryId: string,
  input: OtakuShowcaseUpdateValues,
): Promise<OtakuShowcaseUpdateResponse> {
  const payload = otakuShowcaseUpdateRequestSchema.parse(input);
  const response = await apiRequest(`/otaku/library/${encodeURIComponent(entryId)}/showcase`, {
    method: 'PATCH',
    body: payload,
  });
  const responsePayload = await readJson(response);

  if (!response.ok) {
    throw new OtakuRequestError(
      response.status,
      resolveErrorMessage(responsePayload, 'Nao foi possivel atualizar o showcase otaku agora.'),
    );
  }

  return otakuShowcaseUpdateResponseSchema.parse(responsePayload);
}
