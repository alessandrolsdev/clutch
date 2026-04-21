import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PresenceBadge } from '@/components/profile/presence-badge';

describe('PresenceBadge', () => {
  it('renders richer in-game context when game and platform are available', () => {
    render(
      <PresenceBadge
        status="IN_GAME"
        currentGame="Valorant"
        platform="PC"
      />,
    );

    expect(screen.getByTestId('presence-badge')).toBeInTheDocument();
    expect(screen.getByText(/^jogando$/i)).toBeInTheDocument();
    expect(screen.getByText(/jogando valorant/i)).toBeInTheDocument();
    expect(screen.getByText(/^via pc$/i)).toBeInTheDocument();
  });

  it('keeps the copy honest when no platform or activity context is available', () => {
    render(
      <PresenceBadge
        status="OFFLINE"
        currentGame={null}
        platform={null}
      />,
    );

    expect(screen.getByText(/^offline$/i)).toBeInTheDocument();
    expect(screen.getByText(/sem sessao publica ativa/i)).toBeInTheDocument();
    expect(screen.getByText(/nenhuma plataforma publica ativa/i)).toBeInTheDocument();
  });
});
