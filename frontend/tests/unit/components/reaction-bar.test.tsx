import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReactionBar } from '@/components/feed/reaction-bar';
import { FeedRequestError, togglePostInteraction } from '@/services/feed';

vi.mock('@/services/feed', () => ({
  togglePostInteraction: vi.fn(),
  FeedRequestError: class FeedRequestError extends Error {
    public readonly status: number;

    constructor(status: number, message: string) {
      super(message);
      this.name = 'FeedRequestError';
      this.status = status;
    }
  },
}));

const mockedTogglePostInteraction = vi.mocked(togglePostInteraction);

function renderReactionBar(canInteract = true) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

  render(
    <QueryClientProvider client={queryClient}>
      <ReactionBar
        postId="post-1"
        initialReactionCount={2}
        canInteract={canInteract}
      />
    </QueryClientProvider>,
  );

  return { invalidateQueriesSpy };
}

describe('ReactionBar', () => {
  beforeEach(() => {
    mockedTogglePostInteraction.mockReset();
  });

  it('toggles a reaction and updates the total count', async () => {
    mockedTogglePostInteraction.mockResolvedValue({ added: true });
    const { invalidateQueriesSpy } = renderReactionBar();

    fireEvent.click(screen.getByRole('button', { name: /gg/i }));

    await waitFor(() => {
      expect(mockedTogglePostInteraction).toHaveBeenCalled();
    });
    expect(mockedTogglePostInteraction.mock.calls[0]?.[0]).toEqual({
      postId: 'post-1',
      type: 'GG',
    });

    expect(await screen.findByText(/3 reacoes no total/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /gg/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await waitFor(() => {
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: ['feed'],
      });
    });
  });

  it('renders backend errors from reaction toggle', async () => {
    mockedTogglePostInteraction.mockRejectedValue(
      new FeedRequestError(400, 'Voce nao pode reagir ao proprio post.'),
    );

    renderReactionBar();

    fireEvent.click(screen.getByRole('button', { name: /gg/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /voce nao pode reagir ao proprio post/i,
    );
  });

  it('disables reaction buttons when the user cannot interact', () => {
    renderReactionBar(false);

    expect(screen.getByRole('button', { name: /gg/i })).toBeDisabled();
    expect(screen.getByText(/voce nao pode reagir ao proprio post/i)).toBeInTheDocument();
  });
});
