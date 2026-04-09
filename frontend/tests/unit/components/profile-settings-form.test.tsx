import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProfileSettingsForm } from '@/components/settings/profile-settings-form';
import { useAuth } from '@/hooks/use-auth';
import {
  fetchProfileByUsername,
  updateProfileByUsername,
} from '@/services/profile';

vi.mock('@/hooks/use-auth', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/services/profile', () => ({
  fetchProfileByUsername: vi.fn(),
  updateProfileByUsername: vi.fn(),
  ProfileRequestError: class ProfileRequestError extends Error {
    public readonly status: number;

    constructor(status: number, message: string) {
      super(message);
      this.name = 'ProfileRequestError';
      this.status = status;
    }
  },
}));

vi.mock('@/components/profile/gamer-card', () => ({
  GamerCard: ({ profile }: { profile: { profile: { displayName: string | null; bio: string | null } } }) => (
    <div data-testid="profile-preview">
      {profile.profile.displayName ?? 'sem-nome'}::{profile.profile.bio ?? 'sem-bio'}
    </div>
  ),
}));

const mockedUseAuth = vi.mocked(useAuth);
const mockedFetchProfileByUsername = vi.mocked(fetchProfileByUsername);
const mockedUpdateProfileByUsername = vi.mocked(updateProfileByUsername);

function renderProfileSettingsForm() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <ProfileSettingsForm />
    </QueryClientProvider>,
  );
}

describe('ProfileSettingsForm', () => {
  beforeEach(() => {
    mockedUseAuth.mockReset();
    mockedFetchProfileByUsername.mockReset();
    mockedUpdateProfileByUsername.mockReset();

    mockedUseAuth.mockReturnValue({
      status: 'authenticated',
      user: {
        id: 'user-1',
        username: 'clutchplayer',
        email: 'clutchplayer@clutch.gg',
      },
      logout: vi.fn(),
    });
    mockedFetchProfileByUsername.mockResolvedValue({
      id: 'user-1',
      username: 'clutchplayer',
      createdAt: '2026-03-29T22:15:00.000Z',
      profile: {
        displayName: 'CLUTCH Player',
        bio: 'Bio antiga',
        avatarUrl: null,
        bannerUrl: null,
        accentColor: '#7C3AED',
        badges: ['Founder'],
      },
      stats: {
        level: 18,
        xp: 4820,
        reputation: 215,
        friendCount: 2,
        postCount: 2,
      },
      presence: {
        status: 'ONLINE',
        currentGame: null,
        gameDetails: null,
        platform: 'PC',
        updatedAt: '2026-03-29T22:15:00.000Z',
      },
      platformIntegrations: [],
      gameLibrary: [],
    });
  });

  it('renders profile preview and updates it locally', async () => {
    renderProfileSettingsForm();

    expect(await screen.findByTestId('settings-profile-success')).toBeInTheDocument();
    expect(screen.getByTestId('profile-preview')).toHaveTextContent(
      'CLUTCH Player::Bio antiga',
    );

    fireEvent.change(screen.getByLabelText(/display name/i), {
      target: { value: 'Novo nome' },
    });
    fireEvent.change(screen.getByLabelText(/bio/i), {
      target: { value: 'Bio atualizada' },
    });

    await waitFor(() => {
      expect(screen.getByTestId('profile-preview')).toHaveTextContent(
        'Novo nome::Bio atualizada',
      );
    });
  });

  it('submits the real profile patch payload', async () => {
    mockedUpdateProfileByUsername.mockResolvedValue({
      id: 'profile-1',
      userId: 'user-1',
      displayName: 'Novo nome',
      bio: 'Bio atualizada',
      avatarUrl: null,
      bannerUrl: null,
      accentColor: '#7C3AED',
      badges: ['Founder'],
      createdAt: '2026-03-29T22:15:00.000Z',
      updatedAt: '2026-03-31T22:15:00.000Z',
    });

    renderProfileSettingsForm();

    await screen.findByTestId('settings-profile-success');

    fireEvent.change(screen.getByLabelText(/display name/i), {
      target: { value: 'Novo nome' },
    });
    fireEvent.change(screen.getByLabelText(/bio/i), {
      target: { value: 'Bio atualizada' },
    });

    fireEvent.click(screen.getByRole('button', { name: /salvar perfil/i }));

    await waitFor(() => {
      expect(mockedUpdateProfileByUsername).toHaveBeenCalled();
    });

    expect(mockedUpdateProfileByUsername.mock.calls[0]?.[0]).toBe('clutchplayer');
    expect(mockedUpdateProfileByUsername.mock.calls[0]?.[1]).toMatchObject({
      displayName: 'Novo nome',
      bio: 'Bio atualizada',
      accentColor: '#7C3AED',
    });
  });
});
