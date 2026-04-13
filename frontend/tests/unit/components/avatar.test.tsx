import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Avatar } from '@/components/ui/avatar';

describe('Avatar', () => {
  it('renders generic remote URLs with native image support and falls back on error', () => {
    render(
      <Avatar
        src="https://cdn.example.com/avatar.png"
        alt="player avatar"
        fallback="CP"
      />,
    );

    const image = screen.getByAltText(/player avatar/i);
    expect(image.tagName).toBe('IMG');

    fireEvent.error(image);

    expect(screen.getByText('CP')).toBeInTheDocument();
  });
});
