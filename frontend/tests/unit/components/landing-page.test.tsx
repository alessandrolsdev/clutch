import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import AuthLandingPage from '@/app/(auth)/page';

describe('AuthLandingPage', () => {
  it('presents the gamer identity with working registration and exploration links', () => {
    render(<AuthLandingPage />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'NÃO É SÓ',
    );
    expect(
      screen.getByRole('link', { name: /criar conta grátis/i }),
    ).toHaveAttribute('href', '/register');
    expect(
      screen.getByRole('link', { name: /explorar o clutch/i }),
    ).toHaveAttribute('href', '#universo');
    expect(document.getElementById('universo')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /já tem conta/i })).toHaveAttribute(
      'href',
      '/login',
    );
    expect(screen.getByTestId('landing-preview')).toHaveTextContent(
      'PRÉVIA ILUSTRATIVA',
    );
    expect(screen.getAllByRole('article')).toHaveLength(3);
  });
});
