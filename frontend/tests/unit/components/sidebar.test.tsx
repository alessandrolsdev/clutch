import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Sidebar } from '@/components/layout/sidebar';
import { useAuth } from '@/hooks/use-auth';

const usePathnameMock = vi.fn();

vi.mock('next/navigation', () => ({
  usePathname: () => usePathnameMock(),
}));

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    onClick,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    onClick?: () => void;
  } & React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a
      href={href}
      onClick={(event) => {
        event.preventDefault();
        onClick?.();
      }}
      {...props}
    >
      {children}
    </a>
  ),
}));

vi.mock('@/hooks/use-auth', () => ({
  useAuth: vi.fn(),
}));

const mockedUseAuth = vi.mocked(useAuth);

describe('Sidebar', () => {
  beforeEach(() => {
    usePathnameMock.mockReset();
    mockedUseAuth.mockReset();

    usePathnameMock.mockReturnValue('/feed');
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

  it('renders real links for available sections and marks unavailable sections honestly', () => {
    render(<Sidebar isOpen onClose={vi.fn()} />);

    expect(screen.getByText('Feed').closest('a')).toHaveAttribute('href', '/feed');
    expect(screen.getByText('Profile').closest('a')).toHaveAttribute('href', '/clutchplayer');
    expect(screen.getByText('Notifications').closest('a')).toHaveAttribute(
      'href',
      '/notifications',
    );
    expect(screen.getByText('Arena').closest('a')).toHaveAttribute('href', '/arena');
    expect(screen.getByText('Settings').closest('a')).toHaveAttribute('href', '/settings');

    expect(screen.queryByRole('link', { name: /friends/i })).not.toBeInTheDocument();
    expect(screen.getByText(/ainda nao existe uma pagina dedicada de amigos/i)).toBeInTheDocument();
    expect(screen.getByText('Em breve')).toBeInTheDocument();
  });

  it('closes the sidebar when navigating through a real link', () => {
    const onClose = vi.fn();

    render(<Sidebar isOpen onClose={onClose} />);

    fireEvent.click(screen.getByRole('link', { name: /notifications/i }));

    expect(onClose).toHaveBeenCalled();
  });
});
