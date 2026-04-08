import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import AuthLandingPage from '@/app/(auth)/page';

vi.mock('framer-motion', () => ({
  motion: {
    div: ({
      children,
      ...props
    }: React.HTMLAttributes<HTMLDivElement> & { children: React.ReactNode }) => (
      <div {...props}>{children}</div>
    ),
  },
}));

describe('AuthLandingPage', () => {
  it('renders the public landing with real CTAs', () => {
    render(<AuthLandingPage />);

    expect(
      screen.getByRole('heading', { name: /revele sua verdadeira identidade/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /criar conta gratis/i }),
    ).toHaveAttribute('href', '/register');
    expect(
      screen.getByRole('link', { name: /ver demo/i }),
    ).toHaveAttribute('href', '/login');
    expect(screen.getByTestId('landing-preview')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /entre agora e conecte seu perfil ao clutch/i }),
    ).toBeInTheDocument();
  });
});
