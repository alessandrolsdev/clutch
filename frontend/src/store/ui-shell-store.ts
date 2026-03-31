import { create } from 'zustand';

type UiShellState = {
  isRoadmapOpen: boolean;
  toggleRoadmap: () => void;
};

export const useUiShellStore = create<UiShellState>((set) => ({
  isRoadmapOpen: false,
  toggleRoadmap: () =>
    set((state) => ({
      isRoadmapOpen: !state.isRoadmapOpen,
    })),
}));
