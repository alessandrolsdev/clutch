import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchPresenceCredential,
  PresenceConnection,
  PresenceRequestError,
} from '@/services/presence';

type Listener = (event: Event) => void;

class FakeWebSocket {
  public static readonly OPEN = 1;

  public readyState = 0;
  public readonly sent: string[] = [];
  private readonly listeners = new Map<string, Set<Listener>>();

  addEventListener(type: string, listener: Listener) {
    const current = this.listeners.get(type) ?? new Set<Listener>();
    current.add(listener);
    this.listeners.set(type, current);
  }

  removeEventListener(type: string, listener: Listener) {
    this.listeners.get(type)?.delete(listener);
  }

  close() {
    this.readyState = 3;
    this.emit('close', new Event('close'));
  }

  send(data: string) {
    this.sent.push(data);
  }

  emitOpen() {
    this.readyState = FakeWebSocket.OPEN;
    this.emit('open', new Event('open'));
  }

  emitMessage(data: string) {
    this.emit('message', { data } as MessageEvent<string>);
  }

  emitClose() {
    this.readyState = 3;
    this.emit('close', new Event('close'));
  }

  private emit(type: string, event: Event) {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event);
    }
  }
}

describe('presence service', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_WS_URL = 'ws://localhost:8080';
    vi.restoreAllMocks();
    vi.stubGlobal('WebSocket', { OPEN: FakeWebSocket.OPEN });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('hydrates the presence credential from the local auth route', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        return new Response(JSON.stringify({ token: 'jwt-token' }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        });
      }) as typeof fetch,
    );

    await expect(fetchPresenceCredential()).resolves.toBe('jwt-token');
  });

  it('opens the websocket with the authenticated token and parses presence events', async () => {
    const createdUrls: string[] = [];
    const socket = new FakeWebSocket();
    const onPresence = vi.fn();
    const onStatus = vi.fn();

    const connection = new PresenceConnection({
      getCredential: vi.fn(async () => 'jwt-token'),
      socketFactory: (url) => {
        createdUrls.push(url);
        return socket;
      },
      onPresence,
      onConnectionStatusChange: onStatus,
    });

    connection.connect();
    await vi.waitFor(() => {
      expect(createdUrls).toHaveLength(1);
    });

    expect(createdUrls[0]).toContain('/ws/presence?token=jwt-token');
    expect(createdUrls[0]).not.toContain('userId=');

    socket.emitOpen();
    socket.emitMessage(
      JSON.stringify({
        event: 'FRIEND_PRESENCE',
        payload: {
          userId: 'friend-1',
          status: 'IN_GAME',
          currentGame: 'Valorant',
          platform: 'PC',
        },
        ts: 321,
      }),
    );

    expect(onStatus).toHaveBeenCalledWith('connected', null);
    expect(onPresence).toHaveBeenCalledWith(
      {
        userId: 'friend-1',
        status: 'IN_GAME',
        currentGame: 'Valorant',
        platform: 'PC',
      },
      321,
    );
  });

  it('stops the flow and reports auth error when the credential route rejects the session', async () => {
    const onAuthFailure = vi.fn();
    const onStatus = vi.fn();
    const connection = new PresenceConnection({
      getCredential: vi.fn(async () => {
        throw new PresenceRequestError(401, 'Token invalido ou expirado.');
      }),
      onPresence: vi.fn(),
      onConnectionStatusChange: onStatus,
      onAuthFailure,
    });

    connection.connect();

    await vi.waitFor(() => {
      expect(onAuthFailure).toHaveBeenCalled();
    });

    expect(onStatus).toHaveBeenCalledWith('auth_error', 'Token invalido ou expirado.');
  });

  it('reconnects with backoff after an unexpected socket close', async () => {
    vi.useFakeTimers();

    const sockets = [new FakeWebSocket(), new FakeWebSocket()];
    const getCredential = vi.fn(async () => 'jwt-token');
    const connection = new PresenceConnection({
      getCredential,
      socketFactory: vi
        .fn()
        .mockImplementationOnce(() => sockets[0])
        .mockImplementationOnce(() => sockets[1]),
      onPresence: vi.fn(),
      onConnectionStatusChange: vi.fn(),
    });

    connection.connect();
    await vi.runAllTimersAsync();
    sockets[0]!.emitOpen();
    sockets[0]!.emitClose();

    await vi.advanceTimersByTimeAsync(1_000);

    expect(getCredential).toHaveBeenCalledTimes(2);
  });
});
