import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CommunityPageContent } from '@/components/communities/community-page-content';
import { useAuth } from '@/hooks/use-auth';
import {
  archiveCommunity,
  fetchCommunityBySlug,
  joinCommunity,
  leaveCommunity,
} from '@/services/communities';

vi.mock('@/hooks/use-auth', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/services/communities', () => ({
  fetchCommunityBySlug: vi.fn(),
  joinCommunity: vi.fn(),
  leaveCommunity: vi.fn(),
  archiveCommunity: vi.fn(),
}));

const mockedUseAuth = vi.mocked(useAuth);
const mockedFetchCommunityBySlug = vi.mocked(fetchCommunityBySlug);
const mockedJoinCommunity = vi.mocked(joinCommunity);
const mockedLeaveCommunity = vi.mocked(leaveCommunity);
const mockedArchiveCommunity = vi.mocked(archiveCommunity);

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

function renderCommunityPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <CommunityPageContent slug="guilda-dos-speedrunners" />
    </QueryClientProvider>,
  );
}

describe('CommunityPageContent', () => {
  beforeEach(() => {
    mockedUseAuth.mockReset();
    mockedFetchCommunityBySlug.mockReset();
    mockedJoinCommunity.mockReset();
    mockedLeaveCommunity.mockReset();
    mockedArchiveCommunity.mockReset();
    mockedUseAuth.mockReturnValue({
      user: { id: 'user-id-1', username: 'clutchplayer', email: 'player@clutch.gg' },
      status: 'authenticated',
      logout: vi.fn(),
    });
  });

  it('renders public community identity and membership CTA', async () => {
    mockedFetchCommunityBySlug.mockResolvedValue(community);

    renderCommunityPage();

    expect(await screen.findByRole('heading', {
      name: 'Guilda dos Speedrunners',
    })).toBeInTheDocument();
    expect(screen.getByText(/12 membros/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /participar/i })).toBeInTheDocument();
  });

  it('joins community when authenticated viewer is not a member', async () => {
    mockedFetchCommunityBySlug.mockResolvedValue(community);
    mockedJoinCommunity.mockResolvedValue({
      ...community,
      memberCount: 13,
      viewerMembershipRole: 'MEMBER',
    });

    renderCommunityPage();

    fireEvent.click(await screen.findByRole('button', { name: /participar/i }));

    await waitFor(() => {
      expect(mockedJoinCommunity).toHaveBeenCalledWith('guilda-dos-speedrunners');
    });
  });

  it('leaves community when authenticated viewer is member', async () => {
    mockedFetchCommunityBySlug.mockResolvedValue({
      ...community,
      viewerMembershipRole: 'MEMBER',
    });
    mockedLeaveCommunity.mockResolvedValue(community);

    renderCommunityPage();

    fireEvent.click(await screen.findByRole('button', { name: /sair da comunidade/i }));

    await waitFor(() => {
      expect(mockedLeaveCommunity).toHaveBeenCalledWith('guilda-dos-speedrunners');
    });
  });

  it('shows archived state without join CTA on direct access', async () => {
    mockedFetchCommunityBySlug.mockResolvedValue({
      ...community,
      status: 'ARCHIVED',
    });

    renderCommunityPage();

    expect(await screen.findByText('Arquivada')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /participar/i })).not.toBeInTheDocument();
    expect(screen.getByText(/ações de participação estão indisponíveis/i)).toBeInTheDocument();
  });

  it('lets owner archive an active community', async () => {
    mockedFetchCommunityBySlug.mockResolvedValue({
      ...community,
      viewerMembershipRole: 'OWNER',
    });
    mockedArchiveCommunity.mockResolvedValue({
      ...community,
      status: 'ARCHIVED',
      viewerMembershipRole: 'OWNER',
    });

    renderCommunityPage();

    fireEvent.click(await screen.findByRole('button', { name: /arquivar comunidade/i }));

    await waitFor(() => {
      expect(mockedArchiveCommunity).toHaveBeenCalledWith('guilda-dos-speedrunners');
    });
  });

  it('does not show archive action to regular members', async () => {
    mockedFetchCommunityBySlug.mockResolvedValue({
      ...community,
      viewerMembershipRole: 'MEMBER',
    });

    renderCommunityPage();

    await screen.findByRole('button', { name: /sair da comunidade/i });
    expect(screen.queryByRole('button', { name: /arquivar comunidade/i })).not.toBeInTheDocument();
  });

  it('lets member leave archived community without join action', async () => {
    mockedFetchCommunityBySlug.mockResolvedValue({
      ...community,
      status: 'ARCHIVED',
      viewerMembershipRole: 'MEMBER',
    });
    mockedLeaveCommunity.mockResolvedValue({
      ...community,
      status: 'ARCHIVED',
      viewerMembershipRole: null,
    });

    renderCommunityPage();

    fireEvent.click(await screen.findByRole('button', { name: /sair da comunidade arquivada/i }));

    await waitFor(() => {
      expect(mockedLeaveCommunity).toHaveBeenCalledWith('guilda-dos-speedrunners');
    });
    expect(screen.queryByRole('button', { name: /^participar$/i })).not.toBeInTheDocument();
  });
});
