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
        connectionStatus="connected"
      />,
    );

    expect(screen.getByTestId('presence-badge')).toBeInTheDocument();
    expect(screen.getByText(/^jogando$/i)).toBeInTheDocument();
    expect(screen.getByTestId('presence-source-badge')).toHaveTextContent(/ao vivo/i);
    expect(screen.getByText(/jogando valorant/i)).toBeInTheDocument();
    expect(screen.getByText(/via pc • presenca ao vivo/i)).toBeInTheDocument();
  });

  it('signals snapshot fallback when realtime is reconnecting', () => {
    render(
      <PresenceBadge
        status="OFFLINE"
        currentGame={null}
        platform={null}
        connectionStatus="reconnecting"
      />,
    );

    expect(screen.getByText(/^offline$/i)).toBeInTheDocument();
    expect(screen.getByTestId('presence-source-badge')).toHaveTextContent(/reconectando/i);
    expect(screen.getByText(/sem sessao publica ativa/i)).toBeInTheDocument();
    expect(
      screen.getByText(/nenhuma plataforma publica ativa • snapshot durante reconexao/i),
    ).toBeInTheDocument();
  });
});
