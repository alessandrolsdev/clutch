import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { SectionHeading } from '@/components/ui/section-heading';

describe('UI primitives', () => {
  it('renders a button with the default semantics and secondary variant styles', () => {
    render(<Button variant="secondary">Open roadmap</Button>);

    const button = screen.getByRole('button', { name: 'Open roadmap' });

    expect(button).toHaveAttribute('type', 'button');
    expect(button).toHaveClass('bg-[var(--button-background)]');
  });

  it('renders an input with the tokenized surface styles', () => {
    render(<Input placeholder="Search games" disabled />);

    const input = screen.getByPlaceholderText('Search games');

    expect(input).toBeDisabled();
    expect(input).toHaveClass('bg-[var(--input-background)]');
  });

  it('renders badge and card tones for the shell surfaces', () => {
    render(
      <>
        <Card tone="accent">Accent surface</Card>
        <Badge tone="success">Online</Badge>
      </>,
    );

    expect(screen.getByText('Accent surface').closest('div')).toHaveStyle({
      backgroundImage: 'var(--card-background-accent)',
    });
    expect(screen.getByText('Online')).toHaveClass('text-status-online');
  });

  it('renders avatar fallback text and section headings', () => {
    render(
      <>
        <SectionHeading
          eyebrow="Profile"
          title="GamerCard"
          description="Ready for later issues"
        />
        <Avatar alt="Player avatar" fallback="CL" />
      </>,
    );

    expect(screen.getByRole('heading', { name: 'GamerCard' })).toBeInTheDocument();
    expect(screen.getByText('CL')).toBeInTheDocument();
  });
});
