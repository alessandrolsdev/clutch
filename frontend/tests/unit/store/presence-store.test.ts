import { beforeEach, describe, expect, it } from 'vitest';
import { resetPresenceStore, usePresenceStore } from '@/store/presence-store';

describe('presence store', () => {
  beforeEach(() => {
    resetPresenceStore();
  });

  it('starts idle with no presence entries', () => {
    const state = usePresenceStore.getState();

    expect(state.connectionStatus).toBe('idle');
    expect(state.entries).toEqual({});
    expect(state.errorMessage).toBeNull();
  });

  it('stores realtime updates and can clear all state', () => {
    usePresenceStore.getState().setConnectionStatus('connected');
    usePresenceStore.getState().upsertPresence(
      {
        userId: 'friend-1',
        status: 'IN_GAME',
        currentGame: 'Valorant',
        platform: 'PC',
      },
      123,
    );

    expect(usePresenceStore.getState().entries['friend-1']).toEqual({
      userId: 'friend-1',
      status: 'IN_GAME',
      currentGame: 'Valorant',
      platform: 'PC',
      receivedAt: 123,
    });

    usePresenceStore.getState().clearAll();

    expect(usePresenceStore.getState().connectionStatus).toBe('idle');
    expect(usePresenceStore.getState().entries).toEqual({});
  });
});
