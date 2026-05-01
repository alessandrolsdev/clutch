import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CommunitiesPageContent } from '@/components/communities/communities-page-content';
import { useAuth } from '@/hooks/use-auth';
import { createCommunity, fetchCommunities } from '@/services/communities';

const routerPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: routerPush,
  }),
}));

vi.mock('@/hooks/use-auth', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/services/communities', () => ({
  createCommunity: vi.fn(),
  fetchCommunities: vi.fn(),
}));

const mockedUseAuth = vi.mocked(useAuth);
const mockedFetchCommunities = vi.mocked(fetchCommunities);
const mockedCreateCommunity = vi.mocked(createCommunity);

const community = {
  id: 'community-id-1',
  slug: 'guilda-dos-speedrunners',
  name: 'Guilda dos Speedrunners',
  description: 'Runs, PBs e desafios semanais.',
  visibility: 'PUBLIC' as const,
  status: 'ACTIVE' as const,
  owner: {
    id: 'owner-id-1',
    username: 'owner',
    displayName: 'Owner',
    avatarUrl: null,
  },
  memberCount: 12,
  createdAt: '2026-04-25T10:00:00.000Z',
  updatedAt: '2026-04-25T10:00:00.000Z',
  viewerMembershipRole: null,
};

function renderCommunitiesPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <CommunitiesPageContent />
    </QueryClientProvider>,
  );
}

describe('CommunitiesPageContent', () => {
  beforeEach(() => {
    routerPush.mockReset();
    mockedUseAuth.mockReset();
    mockedFetchCommunities.mockReset();
    mockedCreateCommunity.mockReset();
    mockedUseAuth.mockReturnValue({
      user: { id: 'user-id-1', username: 'clutchplayer', email: 'player@clutch.gg' },
      status: 'authenticated',
      logout: vi.fn(),
    });
  });

  it('renders public communities with member count', async () => {
    mockedFetchCommunities.mockResolvedValue([community]);

    renderCommunitiesPage();

    expect(await screen.findByText('Guilda dos Speedrunners')).toBeInTheDocument();
    expect(screen.getByText(/12 membros/i)).toBeInTheDocument();
    expect(screen.getByText(/owner: owner/i)).toBeInTheDocument();
  });

  it('does not render archived communities in public discovery', async () => {
    mockedFetchCommunities.mockResolvedValue([
      community,
      {
        ...community,
        id: 'community-id-2',
        slug: 'guilda-arquivada',
        name: 'Guilda Arquivada',
        status: 'ARCHIVED',
      },
    ]);

    renderCommunitiesPage();

    expect(await screen.findByText('Guilda dos Speedrunners')).toBeInTheDocument();
    expect(screen.queryByText('Guilda Arquivada')).not.toBeInTheDocument();
  });

  it('creates a community and navigates to its public page', async () => {
    mockedFetchCommunities.mockResolvedValue([]);
    mockedCreateCommunity.mockResolvedValue(community);

    renderCommunitiesPage();

    fireEvent.change(screen.getByLabelText(/^nome$/i), {
      target: { value: 'Guilda dos Speedrunners' },
    });
    fireEvent.change(screen.getByLabelText(/^descrição curta$/i), {
      target: { value: 'Runs, PBs e desafios semanais.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /criar comunidade/i }));

    await waitFor(() => {
      expect(mockedCreateCommunity).toHaveBeenCalled();
    });
    expect(mockedCreateCommunity.mock.calls[0]?.[0]).toEqual({
      name: 'Guilda dos Speedrunners',
      description: 'Runs, PBs e desafios semanais.',
    });
    expect(routerPush).toHaveBeenCalledWith('/communities/guilda-dos-speedrunners');
  });
});
