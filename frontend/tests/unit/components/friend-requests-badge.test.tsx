import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FriendRequestsBadge } from '@/components/friends/friend-requests-badge';

describe('FriendRequestsBadge', () => {
  it('renders the pending request count', () => {
    render(<FriendRequestsBadge count={3} />);

    expect(screen.getByText('3')).toBeInTheDocument();
  });
});
