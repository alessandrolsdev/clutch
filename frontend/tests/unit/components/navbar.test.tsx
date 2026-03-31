import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Navbar } from '@/components/layout/navbar';
import { useAuth } from '@/hooks/use-auth';
import { fetchPendingFriendRequests } from '@/services/friends';

vi.mock('@/hooks/use-auth', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/services/friends', () => ({
  fetchPendingFriendRequests: vi.fn(),
}));

vi.mock('@/components/friends/friend-request-card', () => ({
  FriendRequestCard: ({ request }: { request: { sender: { username: string } } }) => (
    <div data-testid="friend-request-card">{request.sender.username}</div>
  ),
}));

vi.mock('@/components/notifications/notifications-bell', () => ({
  NotificationsBell: () => <div data-testid="notifications-bell">notifications-bell</div>,
}));

const mockedUseAuth = vi.mocked(useAuth);
const mockedFetchPendingFriendRequests = vi.mocked(fetchPendingFriendRequests);

function renderNavbar() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <Navbar variant="app" />
    </QueryClientProvider>,
  );
}

describe('Navbar', () => {
  beforeEach(() => {
    mockedUseAuth.mockReset();
    mockedFetchPendingFriendRequests.mockReset();

    mockedUseAuth.mockReturnValue({
      status: 'authenticated',
      user: {
        id: 'user-1',
        username: 'clutchplayer',
        email: 'clutchplayer@clutch.gg',
      },
      logout: vi.fn(),
    });
  });

  it('renders the pending requests count in the navbar', async () => {
    mockedFetchPendingFriendRequests.mockResolvedValue([
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
    ]);

    renderNavbar();

    expect(screen.getByTestId('notifications-bell')).toBeInTheDocument();
    expect(await screen.findByText('1')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /open friend requests preview/i }));

    expect(await screen.findByTestId('friend-request-card')).toHaveTextContent(
      /pixelsamurai/i,
    );
  });
});
