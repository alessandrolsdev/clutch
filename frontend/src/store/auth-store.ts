import { create } from 'zustand';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

export type AuthUser = {
  id: string;
  username: string;
  email: string;
};

type AuthState = {
  status: AuthStatus;
  user: AuthUser | null;
  setLoading: () => void;
  setSession: (user: AuthUser) => void;
  clearSession: () => void;
};

const initialState = {
  status: 'loading' as AuthStatus,
  user: null as AuthUser | null,
};

export const useAuthStore = create<AuthState>((set) => ({
  ...initialState,
  setLoading: () => set({ status: 'loading' }),
  setSession: (user) => set({ status: 'authenticated', user }),
  clearSession: () => set({ status: 'unauthenticated', user: null }),
}));

export function resetAuthStore(): void {
  useAuthStore.setState(initialState);
}
