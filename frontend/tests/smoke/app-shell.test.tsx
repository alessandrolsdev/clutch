import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AppShell } from '@/components/layout/app-shell';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
}));

describe('AppShell', () => {
  it('renders the authenticated shell and toggles the mobile sidebar', () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <AppShell>
          <div>Authenticated content</div>
        </AppShell>
      </QueryClientProvider>,
    );

    expect(screen.getByText('Authenticated content')).toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: /primary sidebar/i })).toHaveAttribute(
      'data-open',
      'false',
    );

    const toggleButton = screen.getByRole('button', { name: /open sidebar/i });
    fireEvent.click(toggleButton);

    expect(screen.getByRole('complementary', { name: /primary sidebar/i })).toHaveAttribute(
      'data-open',
      'true',
    );
    expect(screen.getByText('clutchplayer@clutch.gg')).toBeInTheDocument();
  });
});
