import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AppShell } from '@/components/layout/app-shell';
import type { FoundationCard } from '@/types/foundation';

const cards: FoundationCard[] = [
  {
    title: 'Next.js 15',
    description: 'App Router ready for the next frontend issues.',
    tone: 'accent',
  },
];

describe('AppShell', () => {
  it('renders the foundation shell and toggles the roadmap panel', () => {
    render(
      <AppShell cards={cards}>
        <div>Foundation content</div>
      </AppShell>,
    );

    expect(screen.getByRole('heading', { name: /clutch frontend foundation/i })).toBeInTheDocument();
    expect(screen.getByText('Foundation content')).toBeInTheDocument();

    const toggleButton = screen.getByRole('button', { name: /show roadmap/i });
    fireEvent.click(toggleButton);

    expect(screen.getByText(/design tokens and primitives/i)).toBeInTheDocument();
  });
});
