import { beforeEach, describe, expect, it } from 'vitest';
import { resetAuthStore, useAuthStore } from '@/store/auth-store';

describe('auth store', () => {
  beforeEach(() => {
    resetAuthStore();
  });

  it('starts in loading state with no user', () => {
    const state = useAuthStore.getState();

    expect(state.status).toBe('loading');
    expect(state.user).toBeNull();
  });

  it('stores and clears the authenticated user', () => {
    useAuthStore.getState().setSession({
      id: 'user-1',
      username: 'clutchplayer',
      email: 'clutchplayer@clutch.gg',
    });

    expect(useAuthStore.getState().status).toBe('authenticated');
    expect(useAuthStore.getState().user).toEqual({
      id: 'user-1',
      username: 'clutchplayer',
      email: 'clutchplayer@clutch.gg',
    });

    useAuthStore.getState().clearSession();

    expect(useAuthStore.getState().status).toBe('unauthenticated');
    expect(useAuthStore.getState().user).toBeNull();
  });
});
