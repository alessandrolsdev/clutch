import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CommunityPageContent } from '@/components/communities/community-page-content';
import { useAuth } from '@/hooks/use-auth';
import {
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
  cancelCommunityEvent: vi.fn(),
  createCommunityEvent: vi.fn(),
  fetchCommunityBySlug: vi.fn(),
  fetchCommunityEvents: vi.fn(),
  joinCommunity: vi.fn(),
  leaveCommunity: vi.fn(),
  setCommunityEventRsvp: vi.fn(),
}));

const mockedUseAuth = vi.mocked(useAuth);
const mockedCancelCommunityEvent = vi.mocked(cancelCommunityEvent);
const mockedCreateCommunityEvent = vi.mocked(createCommunityEvent);
const mockedFetchCommunityBySlug = vi.mocked(fetchCommunityBySlug);
const mockedFetchCommunityEvents = vi.mocked(fetchCommunityEvents);
const mockedJoinCommunity = vi.mocked(joinCommunity);
const mockedLeaveCommunity = vi.mocked(leaveCommunity);
const mockedSetCommunityEventRsvp = vi.mocked(setCommunityEventRsvp);

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

const event = {
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
    mockedCancelCommunityEvent.mockReset();
    mockedCreateCommunityEvent.mockReset();
    mockedFetchCommunityBySlug.mockReset();
    mockedFetchCommunityEvents.mockReset();
    mockedJoinCommunity.mockReset();
    mockedLeaveCommunity.mockReset();
    mockedSetCommunityEventRsvp.mockReset();
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

  it('renders community events inside the community page', async () => {
    mockedFetchCommunityBySlug.mockResolvedValue({
      ...community,
      viewerMembershipRole: 'MEMBER',
    });
    mockedFetchCommunityEvents.mockResolvedValue([event]);

    renderCommunityPage();

    expect(await screen.findByText('Noite de ranked')).toBeInTheDocument();
    expect(screen.getByText(/0 vou/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^vou$/i })).toBeInTheDocument();
  });

  it('updates RSVP from the community event block', async () => {
    mockedFetchCommunityBySlug.mockResolvedValue({
      ...community,
      viewerMembershipRole: 'MEMBER',
    });
    mockedFetchCommunityEvents.mockResolvedValue([event]);
    mockedSetCommunityEventRsvp.mockResolvedValue({
      ...event,
      viewerRsvp: 'GOING',
      rsvpCounts: { going: 1, interested: 0, notGoing: 0 },
    });

    renderCommunityPage();

    fireEvent.click(await screen.findByRole('button', { name: /^vou$/i }));

    await waitFor(() => {
      expect(mockedSetCommunityEventRsvp).toHaveBeenCalledWith(
        'guilda-dos-speedrunners',
        'event-id-1',
        'GOING',
      );
    });
  });

  it('lets owner create and cancel events from the community page', async () => {
    mockedFetchCommunityBySlug.mockResolvedValue({
      ...community,
      viewerMembershipRole: 'OWNER',
    });
    mockedFetchCommunityEvents.mockResolvedValue([event]);
    mockedCreateCommunityEvent.mockResolvedValue(event);
    mockedCancelCommunityEvent.mockResolvedValue({
      ...event,
      status: 'CANCELLED',
    });

    renderCommunityPage();

    fireEvent.change(await screen.findByLabelText(/^título$/i), {
      target: { value: 'Noite de ranked' },
    });
    fireEvent.change(screen.getByLabelText(/^início$/i), {
      target: { value: '2099-05-01T23:00' },
    });
    fireEvent.click(screen.getByRole('button', { name: /criar evento/i }));

    await waitFor(() => {
      expect(mockedCreateCommunityEvent).toHaveBeenCalled();
    });
    expect(mockedCreateCommunityEvent.mock.calls[0]?.[0]).toBe('guilda-dos-speedrunners');
    expect(mockedCreateCommunityEvent.mock.calls[0]?.[1]).toMatchObject({
      title: 'Noite de ranked',
    });

    fireEvent.click(screen.getByRole('button', { name: /cancelar evento/i }));

    await waitFor(() => {
      expect(mockedCancelCommunityEvent).toHaveBeenCalledWith(
        'guilda-dos-speedrunners',
        'event-id-1',
      );
    });
  });
});
