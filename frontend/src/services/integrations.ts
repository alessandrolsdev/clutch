import { apiRequest } from '@/lib/api';
import {
  discordOAuthCallbackResponseSchema,
  discordOAuthStartResponseSchema,
  epicConnectRequestSchema,
  epicConnectResponseSchema,
  igdbSearchRequestSchema,
  igdbSearchResponseSchema,
  accountConnectionStartResponseSchema,
  accountUnlinkResponseSchema,
  connectedAccountsResponseSchema,
  connectedAccountSchema,
  connectedAccountVisibilityUpdateRequestSchema,
  type AccountConnectionStartResponse,
  type AccountUnlinkResponse,
  type ConnectedAccountsResponse,
  type ConnectedAccount,
  type ConnectedAccountProvider,
  type ConnectedAccountVisibilityUpdateValues,
  steamConnectRequestSchema,
  steamConnectResponseSchema,
  steamSyncResponseSchema,
  type DiscordOAuthCallbackResponse,
  type DiscordOAuthStartResponse,
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

type DiscordOAuthCallbackInput = {
  code?: string;
  state?: string;
  error?: string;
  errorDescription?: string;
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

export async function startDiscordOAuth(): Promise<DiscordOAuthStartResponse> {
  const response = await apiRequest('/integrations/discord/auth', {
    method: 'GET',
  });
  const responsePayload = await readJson(response);

  if (!response.ok) {
    throw new IntegrationsRequestError(
      response.status,
      resolveErrorMessage(responsePayload, 'Nao foi possivel iniciar a conexao com o Discord agora.'),
    );
  }

  return discordOAuthStartResponseSchema.parse(responsePayload);
}

export async function completeDiscordOAuth(
  input: DiscordOAuthCallbackInput,
): Promise<DiscordOAuthCallbackResponse> {
  const query = new URLSearchParams();

  if (typeof input.code === 'string' && input.code.length > 0) {
    query.set('code', input.code);
  }

  if (typeof input.state === 'string' && input.state.length > 0) {
    query.set('state', input.state);
  }

  if (typeof input.error === 'string' && input.error.length > 0) {
    query.set('error', input.error);
  }

  if (typeof input.errorDescription === 'string' && input.errorDescription.length > 0) {
    query.set('error_description', input.errorDescription);
  }

  const response = await apiRequest(`/integrations/discord/callback?${query.toString()}`, {
    method: 'GET',
  });
  const responsePayload = await readJson(response);

  if (!response.ok) {
    throw new IntegrationsRequestError(
      response.status,
      resolveErrorMessage(responsePayload, 'Nao foi possivel concluir a conexao com o Discord agora.'),
    );
  }

  return discordOAuthCallbackResponseSchema.parse(responsePayload);
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

export async function fetchConnectedAccounts(): Promise<ConnectedAccountsResponse> {
  const response = await apiRequest('/auth/connected-accounts', {
    method: 'GET',
  });
  const responsePayload = await readJson(response);

  if (!response.ok) {
    throw new IntegrationsRequestError(
      response.status,
      resolveErrorMessage(responsePayload, 'Nao foi possivel carregar as contas conectadas agora.'),
    );
  }

  return connectedAccountsResponseSchema.parse(responsePayload);
}

export async function startAccountLink(
  provider: ConnectedAccountProvider,
): Promise<AccountConnectionStartResponse> {
  const response = await apiRequest(`/auth/accounts/${provider.toLowerCase()}/link/start`, {
    method: 'GET',
  });
  const responsePayload = await readJson(response);

  if (!response.ok) {
    throw new IntegrationsRequestError(
      response.status,
      resolveErrorMessage(responsePayload, 'Nao foi possivel iniciar a conexao agora.'),
    );
  }

  return accountConnectionStartResponseSchema.parse(responsePayload);
}

export async function startAccountReauth(
  provider: ConnectedAccountProvider,
): Promise<AccountConnectionStartResponse> {
  const response = await apiRequest(`/auth/accounts/${provider.toLowerCase()}/reauth/start`, {
    method: 'GET',
  });
  const responsePayload = await readJson(response);

  if (!response.ok) {
    throw new IntegrationsRequestError(
      response.status,
      resolveErrorMessage(responsePayload, 'Nao foi possivel iniciar a reconexao agora.'),
    );
  }

  return accountConnectionStartResponseSchema.parse(responsePayload);
}

export async function unlinkConnectedAccount(
  provider: ConnectedAccountProvider,
): Promise<AccountUnlinkResponse> {
  const response = await apiRequest(`/auth/accounts/${provider.toLowerCase()}`, {
    method: 'DELETE',
  });
  const responsePayload = await readJson(response);

  if (!response.ok) {
    throw new IntegrationsRequestError(
      response.status,
      resolveErrorMessage(responsePayload, 'Nao foi possivel desconectar esta conta agora.'),
    );
  }

  return accountUnlinkResponseSchema.parse(responsePayload);
}

export async function updateConnectedAccountVisibility(
  provider: ConnectedAccountProvider,
  input: ConnectedAccountVisibilityUpdateValues,
): Promise<ConnectedAccount> {
  const payload = connectedAccountVisibilityUpdateRequestSchema.parse(input);
  const response = await apiRequest(`/auth/connected-accounts/${provider.toLowerCase()}/visibility`, {
    method: 'PATCH',
    body: payload,
  });
  const responsePayload = await readJson(response);

  if (!response.ok) {
    throw new IntegrationsRequestError(
      response.status,
      resolveErrorMessage(responsePayload, 'Nao foi possivel atualizar a visibilidade agora.'),
    );
  }

  return connectedAccountSchema.parse(responsePayload);
}
