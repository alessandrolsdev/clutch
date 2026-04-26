import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiRequest } from '@/lib/api';
import {
  createCommunity,
  createCommunityEvent,
  fetchCommunityEventById,
  fetchCommunityEvents,
  fetchCommunities,
  fetchCommunityBySlug,
  joinCommunity,
  leaveCommunity,
  setCommunityEventRsvp,
  cancelCommunityEvent,
} from '@/services/communities';

vi.mock('@/lib/api', () => ({
  apiRequest: vi.fn(),
}));

const mockedApiRequest = vi.mocked(apiRequest);

const communityPayload = {
  id: 'community-id-1',
  slug: 'guilda-dos-speedrunners',
  name: 'Guilda dos Speedrunners',
  description: 'Runs, PBs e desafios semanais.',
  visibility: 'PUBLIC',
  status: 'ACTIVE',
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

const eventPayload = {
  id: 'event-id-1',
  communityId: 'community-id-1',
  title: 'Noite de ranked',
  description: 'Fila fechada para subir elo.',
  startsAt: '2099-05-01T23:00:00.000Z',
  status: 'PUBLISHED',
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

describe('communities service', () => {
  beforeEach(() => {
    mockedApiRequest.mockReset();
  });

  it('returns parsed public communities list', async () => {
    mockedApiRequest.mockResolvedValue(
      new Response(JSON.stringify({ communities: [communityPayload] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const response = await fetchCommunities();

    expect(response).toHaveLength(1);
    expect(response[0]?.slug).toBe('guilda-dos-speedrunners');
    expect(mockedApiRequest).toHaveBeenCalledWith('/communities', {
      method: 'GET',
    });
  });

  it('returns parsed public community detail', async () => {
    mockedApiRequest.mockResolvedValue(
      new Response(JSON.stringify({ community: communityPayload }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const response = await fetchCommunityBySlug('guilda-dos-speedrunners');

    expect(response.name).toBe('Guilda dos Speedrunners');
    expect(mockedApiRequest).toHaveBeenCalledWith('/communities/guilda-dos-speedrunners', {
      method: 'GET',
    });
  });

  it('creates a community with the real contract', async () => {
    mockedApiRequest.mockResolvedValue(
      new Response(JSON.stringify({ community: communityPayload }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const response = await createCommunity({
      name: 'Guilda dos Speedrunners',
      description: 'Runs, PBs e desafios semanais.',
    });

    expect(response.slug).toBe('guilda-dos-speedrunners');
    expect(mockedApiRequest).toHaveBeenCalledWith('/communities', {
      method: 'POST',
      body: {
        name: 'Guilda dos Speedrunners',
        description: 'Runs, PBs e desafios semanais.',
      },
    });
  });

  it('joins a community by slug', async () => {
    mockedApiRequest.mockResolvedValue(
      new Response(
        JSON.stringify({
          community: { ...communityPayload, viewerMembershipRole: 'MEMBER' },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    const response = await joinCommunity('guilda-dos-speedrunners');

    expect(response.viewerMembershipRole).toBe('MEMBER');
    expect(mockedApiRequest).toHaveBeenCalledWith('/communities/guilda-dos-speedrunners/join', {
      method: 'POST',
    });
  });

  it('leaves a community by slug', async () => {
    mockedApiRequest.mockResolvedValue(
      new Response(JSON.stringify({ community: communityPayload }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const response = await leaveCommunity('guilda-dos-speedrunners');

    expect(response.viewerMembershipRole).toBeNull();
    expect(mockedApiRequest).toHaveBeenCalledWith(
      '/communities/guilda-dos-speedrunners/membership',
      {
        method: 'DELETE',
      },
    );
  });

  it('returns parsed community events list', async () => {
    mockedApiRequest.mockResolvedValue(
      new Response(JSON.stringify({ events: [eventPayload] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const response = await fetchCommunityEvents('guilda-dos-speedrunners');

    expect(response).toHaveLength(1);
    expect(response[0]?.title).toBe('Noite de ranked');
    expect(mockedApiRequest).toHaveBeenCalledWith(
      '/communities/guilda-dos-speedrunners/events',
      { method: 'GET' },
    );
  });

  it('returns parsed community event detail', async () => {
    mockedApiRequest.mockResolvedValue(
      new Response(JSON.stringify({ event: eventPayload }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const response = await fetchCommunityEventById(
      'guilda-dos-speedrunners',
      'event-id-1',
    );

    expect(response.id).toBe('event-id-1');
    expect(mockedApiRequest).toHaveBeenCalledWith(
      '/communities/guilda-dos-speedrunners/events/event-id-1',
      { method: 'GET' },
    );
  });

  it('creates a community event with the real contract', async () => {
    mockedApiRequest.mockResolvedValue(
      new Response(JSON.stringify({ event: eventPayload }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const response = await createCommunityEvent('guilda-dos-speedrunners', {
      title: 'Noite de ranked',
      description: 'Fila fechada para subir elo.',
      startsAt: '2099-05-01T23:00:00.000Z',
    });

    expect(response.title).toBe('Noite de ranked');
    expect(mockedApiRequest).toHaveBeenCalledWith(
      '/communities/guilda-dos-speedrunners/events',
      {
        method: 'POST',
        body: {
          title: 'Noite de ranked',
          description: 'Fila fechada para subir elo.',
          startsAt: '2099-05-01T23:00:00.000Z',
        },
      },
    );
  });

  it('updates RSVP for a community event', async () => {
    mockedApiRequest.mockResolvedValue(
      new Response(
        JSON.stringify({ event: { ...eventPayload, viewerRsvp: 'GOING' } }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    const response = await setCommunityEventRsvp(
      'guilda-dos-speedrunners',
      'event-id-1',
      'GOING',
    );

    expect(response.viewerRsvp).toBe('GOING');
    expect(mockedApiRequest).toHaveBeenCalledWith(
      '/communities/guilda-dos-speedrunners/events/event-id-1/rsvp',
      {
        method: 'POST',
        body: { status: 'GOING' },
      },
    );
  });

  it('cancels a community event', async () => {
    mockedApiRequest.mockResolvedValue(
      new Response(
        JSON.stringify({ event: { ...eventPayload, status: 'CANCELLED' } }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    const response = await cancelCommunityEvent('guilda-dos-speedrunners', 'event-id-1');

    expect(response.status).toBe('CANCELLED');
    expect(mockedApiRequest).toHaveBeenCalledWith(
      '/communities/guilda-dos-speedrunners/events/event-id-1',
      { method: 'DELETE' },
    );
  });
});
