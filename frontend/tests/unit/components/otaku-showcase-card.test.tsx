import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { OtakuShowcaseCard } from '@/components/profile/otaku-showcase-card';
import { type ProfileResponse } from '@/schemas/profile';

type OtakuShowcaseFixture = ProfileResponse['otakuShowcase'];

describe('OtakuShowcaseCard', () => {
  it('renders a compact social showcase when public entries exist', () => {
    const showcase: OtakuShowcaseFixture = {
      featured: [
        {
          id: 'media-1',
          kind: 'ANIME',
          title: 'Sousou no Frieren',
          coverUrl: 'https://cdn.clutch.gg/frieren.jpg',
        },
        {
          id: 'media-2',
          kind: 'MANGA',
          title: 'Blue Lock',
          coverUrl: null,
        },
      ],
      consumingNow: [
        {
          id: 'media-2',
          kind: 'MANGA',
          title: 'Blue Lock',
          coverUrl: null,
        },
      ],
      consumingCount: 1,
      completedCount: 1,
    };

    render(<OtakuShowcaseCard showcase={showcase} />);

    expect(screen.getByTestId('otaku-showcase-card')).toBeInTheDocument();
    expect(screen.getByText(/showcase otaku/i)).toBeInTheDocument();
    expect(screen.getByText(/sousou no frieren/i)).toBeInTheDocument();
    expect(screen.getAllByText(/blue lock/i)).toHaveLength(2);
    expect(screen.getByText(/2 destaques publicos/i)).toBeInTheDocument();
    expect(screen.getByText(/1 obra em consumo/i)).toBeInTheDocument();
    expect(screen.getByText(/1 obra concluida/i)).toBeInTheDocument();
  });

  it('renders an honest empty state when the profile has no public showcase', () => {
    render(<OtakuShowcaseCard showcase={null} />);

    expect(screen.getByTestId('otaku-showcase-card')).toBeInTheDocument();
    expect(screen.getByTestId('otaku-showcase-empty')).toBeInTheDocument();
    expect(
      screen.getByText(/ainda nao ha showcase anime\/manga publico neste perfil/i),
    ).toBeInTheDocument();
  });
});
