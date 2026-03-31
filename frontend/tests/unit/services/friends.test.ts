import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiRequest } from '@/lib/api';
import {
  acceptFriendRequest,
  fetchFriends,
  fetchPendingFriendRequests,
  removeFriend,
  sendFriendRequest,
} from '@/services/friends';

vi.mock('@/lib/api', () => ({
  apiRequest: vi.fn(),
}));

const mockedApiRequest = vi.mocked(apiRequest);

describe('friends service', () => {
  beforeEach(() => {
    mockedApiRequest.mockReset();
  });

  it('returns parsed friends list', async () => {
    mockedApiRequest.mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            id: 'friend-1',
            username: 'pixelsamurai',
            profile: {
              displayName: 'Pixel Samurai',
              avatarUrl: null,
              accentColor: '#06B6D4',
            },
            presence: {
              status: 'ONLINE',
              currentGame: null,
              platform: 'PC',
            },
          },
        ]),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const response = await fetchFriends('user-1');

    expect(response).toHaveLength(1);
    expect(mockedApiRequest).toHaveBeenCalledWith('/friends/user-1', {
      method: 'GET',
    });
  });

  it('returns parsed pending requests', async () => {
    mockedApiRequest.mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            id: 'request-1',
            createdAt: '2026-03-31T10:00:00.000Z',
            sender: {
              id: 'user-2',
              username: 'pixelsamurai',
              profile: {
                displayName: 'Pixel Samurai',
                avatarUrl: null,
              },
            },
          },
        ]),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const response = await fetchPendingFriendRequests('user-1');

    expect(response).toHaveLength(1);
    expect(mockedApiRequest).toHaveBeenCalledWith('/friends/requests/user-1', {
      method: 'GET',
    });
  });

  it('sends a friend request with the real contract', async () => {
    mockedApiRequest.mockResolvedValue(
      new Response(JSON.stringify({ id: 'request-1', status: 'PENDING' }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const response = await sendFriendRequest('user-2');

    expect(response.status).toBe('PENDING');
    expect(mockedApiRequest).toHaveBeenCalledWith('/friends/request/user-2', {
      method: 'POST',
    });
  });

  it('accepts a friend request with the real contract', async () => {
    mockedApiRequest.mockResolvedValue(
      new Response(JSON.stringify({ message: 'Amizade confirmada.' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await acceptFriendRequest('request-1');

    expect(mockedApiRequest).toHaveBeenCalledWith('/friends/accept/request-1', {
      method: 'POST',
    });
  });

  it('removes a friend with the real contract', async () => {
    mockedApiRequest.mockResolvedValue(
      new Response(JSON.stringify({ message: 'Amizade removida.' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await removeFriend('friend-1');

    expect(mockedApiRequest).toHaveBeenCalledWith('/friends/friend-1', {
      method: 'DELETE',
    });
  });
});
