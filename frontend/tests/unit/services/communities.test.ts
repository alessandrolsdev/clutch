import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiRequest } from '@/lib/api';
import {
  createCommunity,
  fetchCommunities,
  fetchCommunityBySlug,
  joinCommunity,
  leaveCommunity,
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
});
