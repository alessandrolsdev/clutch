import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AppShell } from '@/components/layout/app-shell';

describe('AppShell', () => {
  it('renders the authenticated shell and toggles the mobile sidebar', () => {
    render(
      <AppShell>
        <div>Authenticated content</div>
      </AppShell>,
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
    expect(screen.getByText('CLUTCH Player')).toBeInTheDocument();
  });
});
