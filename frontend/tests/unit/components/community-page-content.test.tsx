import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CommunityPageContent } from '@/components/communities/community-page-content';
import { useAuth } from '@/hooks/use-auth';
import {
  archiveCommunity,
  cancelCommunityEvent,
  createCommunityEvent,
  fetchCommunityBySlug,
  fetchCommunityEvents,
  joinCommunity,
  leaveCommunity,
  setCommunityEventRsvp,
} from '@/services/communities';

vi.mock('@/hooks/use-auth', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/services/communities', () => ({
  fetchCommunityBySlug: vi.fn(),
  fetchCommunityEvents: vi.fn(),
  joinCommunity: vi.fn(),
  leaveCommunity: vi.fn(),
  archiveCommunity: vi.fn(),
  createCommunityEvent: vi.fn(),
  setCommunityEventRsvp: vi.fn(),
  cancelCommunityEvent: vi.fn(),
}));

const mockedUseAuth = vi.mocked(useAuth);
const mockedFetchCommunityBySlug = vi.mocked(fetchCommunityBySlug);
const mockedFetchCommunityEvents = vi.mocked(fetchCommunityEvents);
const mockedJoinCommunity = vi.mocked(joinCommunity);
const mockedLeaveCommunity = vi.mocked(leaveCommunity);
const mockedArchiveCommunity = vi.mocked(archiveCommunity);
const mockedCreateCommunityEvent = vi.mocked(createCommunityEvent);
const mockedSetCommunityEventRsvp = vi.mocked(setCommunityEventRsvp);
const mockedCancelCommunityEvent = vi.mocked(cancelCommunityEvent);

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

const communityEvent = {
  id: 'event-id-1',
  communityId: 'community-id-1',
  title: 'Noite de ranked',
  description: 'Fila fechada para subir elo.',
  startsAt: '2099-05-01T23:00:00.000Z',
  status: 'PUBLISHED' as const,
  createdAt: '2026-04-25T10:00:00.000Z',
  updatedAt: '2026-04-25T10:00:00.000Z',
  createdBy: {
    id: 'owner-id-1',
    username: 'owner',
    displayName: 'Owner',
  },
  viewerRsvp: null,
  rsvpCounts: {
    going: 0,
    interested: 0,
    notGoing: 0,
  },
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
    mockedFetchCommunityEvents.mockReset();
    mockedCreateCommunityEvent.mockReset();
    mockedSetCommunityEventRsvp.mockReset();
    mockedCancelCommunityEvent.mockReset();
    mockedFetchCommunityEvents.mockResolvedValue([]);
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

  it('renders community events on the public community page', async () => {
    mockedFetchCommunityBySlug.mockResolvedValue({
      ...community,
      viewerMembershipRole: 'MEMBER',
    });
    mockedFetchCommunityEvents.mockResolvedValue([communityEvent]);

    renderCommunityPage();

    expect(await screen.findByRole('heading', { name: 'Agenda comunitária mínima' }))
      .toBeInTheDocument();
    expect(await screen.findByText('Noite de ranked')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Vou' })).toBeInTheDocument();
  });

  it('renders empty state when community has no events', async () => {
    mockedFetchCommunityBySlug.mockResolvedValue(community);
    mockedFetchCommunityEvents.mockResolvedValue([]);

    renderCommunityPage();

    expect(await screen.findByText(/ainda não há eventos publicados/i)).toBeInTheDocument();
  });

  it('lets owner create a community event', async () => {
    mockedFetchCommunityBySlug.mockResolvedValue({
      ...community,
      viewerMembershipRole: 'OWNER',
    });
    mockedFetchCommunityEvents.mockResolvedValue([]);
    mockedCreateCommunityEvent.mockResolvedValue(communityEvent);

    renderCommunityPage();

    fireEvent.change(await screen.findByLabelText(/^título$/i), {
      target: { value: 'Noite de ranked' },
    });
    fireEvent.change(screen.getByLabelText(/^início$/i), {
      target: { value: '2099-05-01T23:00' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^criar evento$/i }));

    await waitFor(() => {
      expect(mockedCreateCommunityEvent).toHaveBeenCalledWith(
        'guilda-dos-speedrunners',
        expect.objectContaining({
          title: 'Noite de ranked',
        }),
      );
    });
  });

  it('lets member RSVP when community is active', async () => {
    mockedFetchCommunityBySlug.mockResolvedValue({
      ...community,
      viewerMembershipRole: 'MEMBER',
    });
    mockedFetchCommunityEvents.mockResolvedValue([communityEvent]);
    mockedSetCommunityEventRsvp.mockResolvedValue({
      ...communityEvent,
      viewerRsvp: 'GOING',
    });

    renderCommunityPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Vou' }));

    await waitFor(() => {
      expect(mockedSetCommunityEventRsvp).toHaveBeenCalledWith(
        'guilda-dos-speedrunners',
        'event-id-1',
        'GOING',
      );
    });
  });

  it('hides event actions when community is archived', async () => {
    mockedFetchCommunityBySlug.mockResolvedValue({
      ...community,
      status: 'ARCHIVED',
      viewerMembershipRole: 'OWNER',
    });
    mockedFetchCommunityEvents.mockResolvedValue([communityEvent]);

    renderCommunityPage();

    expect(await screen.findByText('Noite de ranked')).toBeInTheDocument();
    expect(screen.getByText(/eventos seguem em modo leitura/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^criar evento$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Vou' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /cancelar evento/i })).not.toBeInTheDocument();
  });

  it('renders cancelled events with status', async () => {
    mockedFetchCommunityBySlug.mockResolvedValue(community);
    mockedFetchCommunityEvents.mockResolvedValue([
      {
        ...communityEvent,
        status: 'CANCELLED',
      },
    ]);

    renderCommunityPage();

    expect(await screen.findByText('Cancelado')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Vou' })).not.toBeInTheDocument();
  });
});
