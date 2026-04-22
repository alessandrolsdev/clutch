import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProfileSettingsForm } from '@/components/settings/profile-settings-form';
import { useAuth } from '@/hooks/use-auth';
import { uploadImage } from '@/services/media';
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

vi.mock('@/services/media', () => ({
  uploadImage: vi.fn(),
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
const mockedUploadImage = vi.mocked(uploadImage);

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
    mockedUploadImage.mockReset();

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
      socialContinuity: {
        currentStreakDays: 0,
        activeFriendOffensiveCount: 0,
        strongestFriendOffensive: null,
      },
    });
    vi.stubGlobal('navigator', {
      clipboard: {
        readText: vi.fn().mockResolvedValue('https://example.com/avatar.png'),
      },
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

  it('supports preview and clipboard paste for remote images', async () => {
    renderProfileSettingsForm();

    await screen.findByTestId('settings-profile-success');

    expect(screen.getByText(/sem avatar configurado/i)).toBeInTheDocument();

    const clipboardButton = screen.getAllByRole('button', { name: /colar link/i })[0];
    expect(clipboardButton).toBeDefined();
    fireEvent.click(clipboardButton as HTMLElement);

    expect(await screen.findByText(/link colado do clipboard/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^avatar$/i)).toHaveValue('https://example.com/avatar.png');
    expect(screen.getByAltText(/preview do avatar/i)).toHaveAttribute(
      'src',
      'https://example.com/avatar.png',
    );

    const clearButton = screen.getAllByRole('button', { name: /limpar/i })[0];
    expect(clearButton).toBeDefined();
    fireEvent.click(clearButton as HTMLElement);

    expect(screen.getByLabelText(/^avatar$/i)).toHaveValue('');
    expect(screen.getByText(/sem avatar configurado/i)).toBeInTheDocument();
  });

  it('uploads a local avatar and applies the returned URL to the preview', async () => {
    mockedUploadImage.mockResolvedValue({
      url: 'http://localhost/api/uploads/images/avatar.png',
      contentType: 'image/png',
      size: 2048,
    });

    renderProfileSettingsForm();

    await screen.findByTestId('settings-profile-success');

    const fileInput = screen.getByLabelText(/arquivo de imagem para avatar/i);
    const avatarFile = new File(['avatar-bytes'], 'avatar.png', {
      type: 'image/png',
    });

    fireEvent.change(fileInput, {
      target: { files: [avatarFile] },
    });

    await waitFor(() => {
      expect(mockedUploadImage).toHaveBeenCalledWith(avatarFile);
    });

    expect(await screen.findByText(/imagem enviada com sucesso/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^avatar$/i)).toHaveValue(
      'http://localhost/api/uploads/images/avatar.png',
    );
    expect(screen.getByAltText(/preview do avatar/i)).toHaveAttribute(
      'src',
      'http://localhost/api/uploads/images/avatar.png',
    );
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
