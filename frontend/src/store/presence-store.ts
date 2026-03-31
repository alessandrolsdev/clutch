import { create } from 'zustand';
import { type FriendPresenceEventPayload } from '@/schemas/presence';

export type PresenceConnectionStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'auth_error'
  | 'error';

export type PresenceEntry = FriendPresenceEventPayload & {
  receivedAt: number;
};

type PresenceState = {
  connectionStatus: PresenceConnectionStatus;
  errorMessage: string | null;
  entries: Record<string, PresenceEntry>;
  setConnectionStatus: (
    status: PresenceConnectionStatus,
    errorMessage?: string | null,
  ) => void;
  upsertPresence: (update: FriendPresenceEventPayload, receivedAt: number) => void;
  clearPresence: (userId: string) => void;
  clearAll: () => void;
};

const initialState = {
  connectionStatus: 'idle' as PresenceConnectionStatus,
  errorMessage: null as string | null,
  entries: {} as Record<string, PresenceEntry>,
};

export const usePresenceStore = create<PresenceState>((set) => ({
  ...initialState,
  setConnectionStatus: (status, errorMessage = null) =>
    set({ connectionStatus: status, errorMessage }),
  upsertPresence: (update, receivedAt) =>
    set((state) => ({
      entries: {
        ...state.entries,
        [update.userId]: {
          ...update,
          receivedAt,
        },
      },
    })),
  clearPresence: (userId) =>
    set((state) => {
      const nextEntries = { ...state.entries };
      delete nextEntries[userId];

      return { entries: nextEntries };
    }),
  clearAll: () =>
    set({
      ...initialState,
      connectionStatus: 'idle',
    }),
}));

export function resetPresenceStore(): void {
  usePresenceStore.setState(initialState);
}
