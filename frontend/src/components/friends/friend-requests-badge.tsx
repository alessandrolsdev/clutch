import { Badge } from '@/components/ui/badge';

type FriendRequestsBadgeProps = {
  count: number;
  isLoading?: boolean;
};

export function FriendRequestsBadge({
  count,
  isLoading = false,
}: FriendRequestsBadgeProps) {
  if (isLoading) {
    return <Badge tone="neutral">...</Badge>;
  }

  return (
    <Badge tone={count > 0 ? 'accent' : 'neutral'}>
      {count}
    </Badge>
  );
}
