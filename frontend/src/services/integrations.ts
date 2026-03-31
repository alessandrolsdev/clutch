import { apiRequest } from '@/lib/api';
import {
  epicConnectRequestSchema,
  epicConnectResponseSchema,
  igdbSearchRequestSchema,
  igdbSearchResponseSchema,
  steamConnectRequestSchema,
  steamConnectResponseSchema,
  steamSyncResponseSchema,
  type EpicConnectResponse,
  type EpicConnectValues,
  type IgdbSearchResponse,
  type SteamConnectResponse,
  type SteamConnectValues,
  type SteamSyncResponse,
} from '@/schemas/integrations';

type ErrorResponse = {
  message?: string;
};

export class IntegrationsRequestError extends Error {
  public readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'IntegrationsRequestError';
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

export async function connectSteam(
  input: SteamConnectValues,
): Promise<SteamConnectResponse> {
  const payload = steamConnectRequestSchema.parse(input);
  const response = await apiRequest('/integrations/steam/connect', {
    method: 'POST',
    body: payload,
  });
  const responsePayload = await readJson(response);

  if (!response.ok) {
    throw new IntegrationsRequestError(
      response.status,
      resolveErrorMessage(responsePayload, 'Nao foi possivel conectar a Steam agora.'),
    );
  }

  return steamConnectResponseSchema.parse(responsePayload);
}

export async function syncSteamLibrary(): Promise<SteamSyncResponse> {
  const response = await apiRequest('/integrations/steam/sync', {
    method: 'POST',
  });
  const responsePayload = await readJson(response);

  if (!response.ok) {
    throw new IntegrationsRequestError(
      response.status,
      resolveErrorMessage(responsePayload, 'Nao foi possivel sincronizar a Steam agora.'),
    );
  }

  return steamSyncResponseSchema.parse(responsePayload);
}

export async function connectEpic(
  input: EpicConnectValues,
): Promise<EpicConnectResponse> {
  const payload = epicConnectRequestSchema.parse(input);
  const response = await apiRequest('/integrations/epic/connect', {
    method: 'POST',
    body: payload,
  });
  const responsePayload = await readJson(response);

  if (!response.ok) {
    throw new IntegrationsRequestError(
      response.status,
      resolveErrorMessage(responsePayload, 'Nao foi possivel conectar a Epic agora.'),
    );
  }

  return epicConnectResponseSchema.parse(responsePayload);
}

export async function searchIgdbGame(query: string): Promise<IgdbSearchResponse> {
  const payload = igdbSearchRequestSchema.parse({ q: query });
  const response = await apiRequest(
    `/integrations/igdb/search?q=${encodeURIComponent(payload.q)}`,
    {
      method: 'GET',
    },
  );
  const responsePayload = await readJson(response);

  if (!response.ok) {
    throw new IntegrationsRequestError(
      response.status,
      resolveErrorMessage(responsePayload, 'Nao foi possivel buscar no IGDB agora.'),
    );
  }

  return igdbSearchResponseSchema.parse(responsePayload);
}
