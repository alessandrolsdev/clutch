'use client';

import {
  friendPresenceSocketEventSchema,
  presenceCredentialResponseSchema,
  presenceUpdateRequestSchema,
  presenceSocketEventSchema,
  type PresenceStatus,
  type FriendPresenceEventPayload,
} from '@/schemas/presence';
import { getClientEnv } from '@/lib/config/env';
import { apiRequest } from '@/lib/api';

type ErrorResponse = {
  message?: string;
};

type PresenceWebSocket = Pick<
  WebSocket,
  'addEventListener' | 'removeEventListener' | 'close' | 'send' | 'readyState'
>;

type PresenceSocketFactory = (url: string) => PresenceWebSocket;
type PresenceConnectionStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'auth_error'
  | 'error';

type PresenceConnectionOptions = {
  getCredential: () => Promise<string>;
  socketFactory?: PresenceSocketFactory;
  onPresence: (payload: FriendPresenceEventPayload, receivedAt: number) => void;
  onConnectionStatusChange?: (
    status: PresenceConnectionStatus,
    errorMessage?: string | null,
  ) => void;
  onAuthFailure?: () => void;
};

export class PresenceRequestError extends Error {
  public readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'PresenceRequestError';
    this.status = status;
  }
}

const initialReconnectDelayMs = 1_000;
const maxReconnectDelayMs = 30_000;
const appPingIntervalMs = 25_000;
export const frontendPresencePlatform = 'WEB';

function readJson(response: Response): Promise<unknown> {
  return response.text().then((text) => {
    if (text.length === 0) {
      return null;
    }

    try {
      return JSON.parse(text) as unknown;
    } catch {
      return null;
    }
  });
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

export async function fetchPresenceCredential(): Promise<string> {
  const response = await fetch('/api/auth/presence-token', {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
  });
  const payload = await readJson(response);

  if (!response.ok) {
    throw new PresenceRequestError(
      response.status,
      resolveErrorMessage(payload, 'Nao foi possivel autenticar o realtime agora.'),
    );
  }

  return presenceCredentialResponseSchema.parse(payload).token;
}

type PublishPresenceOptions = {
  keepalive?: boolean;
};

export async function publishPresenceState(
  input: {
    status: PresenceStatus;
    currentGame?: string | null;
    platform?: string | null;
  },
  options: PublishPresenceOptions = {},
): Promise<void> {
  const payload = presenceUpdateRequestSchema.parse({
    status: input.status,
    currentGame: input.currentGame ?? null,
    platform: input.platform ?? frontendPresencePlatform,
  });

  const response = await apiRequest('/presence', {
    method: 'POST',
    body: payload,
    keepalive: options.keepalive,
    clearSessionOnUnauthorized: false,
  });
  const responsePayload = await readJson(response);

  if (!response.ok) {
    throw new PresenceRequestError(
      response.status,
      resolveErrorMessage(responsePayload, 'Nao foi possivel atualizar sua presenca agora.'),
    );
  }
}

function buildPresenceSocketUrl(token: string): string {
  const { wsUrl } = getClientEnv();
  if (wsUrl.trim().length === 0) {
    throw new PresenceRequestError(
      500,
      'NEXT_PUBLIC_WS_URL nao esta configurada para o realtime.',
    );
  }

  const baseUrl = wsUrl.replace(/\/$/, '');
  const url = new URL(`${baseUrl}/ws/presence`);
  url.searchParams.set('token', token);
  return url.toString();
}

export class PresenceConnection {
  private readonly getCredential: PresenceConnectionOptions['getCredential'];
  private readonly socketFactory: PresenceSocketFactory;
  private readonly onPresence: PresenceConnectionOptions['onPresence'];
  private readonly onConnectionStatusChange?: PresenceConnectionOptions['onConnectionStatusChange'];
  private readonly onAuthFailure?: PresenceConnectionOptions['onAuthFailure'];
  private socket: PresenceWebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectDelayMs = initialReconnectDelayMs;
  private shouldReconnect = true;
  private isConnecting = false;

  constructor(options: PresenceConnectionOptions) {
    this.getCredential = options.getCredential;
    this.socketFactory =
      options.socketFactory ??
      ((url) => new WebSocket(url));
    this.onPresence = options.onPresence;
    this.onConnectionStatusChange = options.onConnectionStatusChange;
    this.onAuthFailure = options.onAuthFailure;
  }

  connect(): void {
    if (this.isConnecting || this.socket) {
      return;
    }

    this.shouldReconnect = true;
    void this.openSocket();
  }

  disconnect(): void {
    this.shouldReconnect = false;
    this.clearReconnectTimer();
    this.clearPingTimer();

    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }

    this.isConnecting = false;
    this.setStatus('idle');
  }

  private async openSocket(): Promise<void> {
    this.isConnecting = true;
    this.setStatus(this.reconnectDelayMs > initialReconnectDelayMs ? 'reconnecting' : 'connecting');

    let token: string;

    try {
      token = await this.getCredential();
    } catch (error) {
      this.isConnecting = false;

      if (error instanceof PresenceRequestError && error.status === 401) {
        this.setStatus('auth_error', error.message);
        this.onAuthFailure?.();
        return;
      }

      const message =
        error instanceof Error
          ? error.message
          : 'Nao foi possivel autenticar o realtime agora.';

      this.setStatus('error', message);
      this.scheduleReconnect();
      return;
    }

    const socket = this.socketFactory(buildPresenceSocketUrl(token));
    this.socket = socket;

    const handleOpen = () => {
      this.isConnecting = false;
      this.reconnectDelayMs = initialReconnectDelayMs;
      this.setStatus('connected');
      this.startPingLoop();
    };

    const handleMessage = (event: Event) => {
      const messageEvent = event as MessageEvent<string>;

      try {
        const parsed = presenceSocketEventSchema.parse(JSON.parse(messageEvent.data));

        if (parsed.event === 'FRIEND_PRESENCE') {
          const update = friendPresenceSocketEventSchema.parse(parsed);
          this.onPresence(update.payload, update.ts);
        }
      } catch {
        return;
      }
    };

    const handleClose = () => {
      this.cleanupSocketListeners(socket, handleOpen, handleMessage, handleClose, handleError);
      this.clearPingTimer();
      this.socket = null;
      this.isConnecting = false;

      if (!this.shouldReconnect) {
        this.setStatus('idle');
        return;
      }

      this.setStatus('error', 'Conexao realtime encerrada.');
      this.scheduleReconnect();
    };

    const handleError = () => {
      this.setStatus('error', 'Falha ao conectar no realtime.');
    };

    socket.addEventListener('open', handleOpen as EventListener);
    socket.addEventListener('message', handleMessage as EventListener);
    socket.addEventListener('close', handleClose as EventListener);
    socket.addEventListener('error', handleError as EventListener);
  }

  private cleanupSocketListeners(
    socket: PresenceWebSocket,
    handleOpen: () => void,
    handleMessage: (event: Event) => void,
    handleClose: () => void,
    handleError: () => void,
  ): void {
    socket.removeEventListener('open', handleOpen as EventListener);
    socket.removeEventListener('message', handleMessage as EventListener);
    socket.removeEventListener('close', handleClose as EventListener);
    socket.removeEventListener('error', handleError as EventListener);
  }

  private scheduleReconnect(): void {
    if (!this.shouldReconnect || this.reconnectTimer) {
      return;
    }

    const delay = this.reconnectDelayMs;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.reconnectDelayMs = Math.min(delay * 2, maxReconnectDelayMs);
      this.connect();
    }, delay);
  }

  private startPingLoop(): void {
    this.clearPingTimer();

    this.pingTimer = setInterval(() => {
      if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
        return;
      }

      this.socket.send(JSON.stringify({ event: 'PING' }));
    }, appPingIntervalMs);
  }

  private clearReconnectTimer(): void {
    if (!this.reconnectTimer) {
      return;
    }

    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }

  private clearPingTimer(): void {
    if (!this.pingTimer) {
      return;
    }

    clearInterval(this.pingTimer);
    this.pingTimer = null;
  }

  private setStatus(
    status: PresenceConnectionStatus,
    errorMessage: string | null = null,
  ): void {
    this.onConnectionStatusChange?.(status, errorMessage);
  }
}
