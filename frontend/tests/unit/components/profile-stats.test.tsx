import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ProfileStats } from '@/components/profile/profile-stats';
import { type ProfileResponse } from '@/schemas/profile';

type StatsFixture = ProfileResponse['stats'];

describe('ProfileStats', () => {
  it('highlights reputation, progression and social counters with the current contract', () => {
    const stats: StatsFixture = {
      reputation: 215,
      level: 18,
      xp: 4820,
      friendCount: 2,
      postCount: 7,
    };

    render(<ProfileStats stats={stats} />);

    expect(screen.getByTestId('profile-stats')).toBeInTheDocument();
    expect(screen.getByText(/resumo social/i)).toBeInTheDocument();
    expect(screen.getByText(/^215$/)).toBeInTheDocument();
    expect(screen.getByText(/nivel 18/i)).toBeInTheDocument();
    expect(screen.getByText(/4.820 xp acumulados/i)).toBeInTheDocument();
    expect(screen.getByText(/^2$/)).toBeInTheDocument();
    expect(screen.getByText(/^7$/)).toBeInTheDocument();
  });

  it('renders an honest fallback when runtime values are not finite', () => {
    const stats: StatsFixture = {
      reputation: Number.NaN,
      level: Number.NaN,
      xp: Number.NaN,
      friendCount: Number.NaN,
      postCount: Number.NaN,
    };

    render(<ProfileStats stats={stats} />);

    expect(screen.getAllByText(/^Indisponivel$/)).toHaveLength(3);
    expect(screen.getByText(/nivel indisponivel/i)).toBeInTheDocument();
    expect(screen.getByText(/xp indisponivel no payload atual/i)).toBeInTheDocument();
  });
});
