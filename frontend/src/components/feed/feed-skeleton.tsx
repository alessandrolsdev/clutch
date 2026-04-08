import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

type FeedSkeletonProps = {
  items?: number;
};

export function FeedSkeleton({ items = 2 }: FeedSkeletonProps) {
  return (
    <div className="space-y-4" data-testid="feed-loading">
      {Array.from({ length: items }).map((_, index) => (
        <Card key={index}>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="mt-4 h-6 w-full" />
          <Skeleton className="mt-2 h-6 w-2/3" />
        </Card>
      ))}
    </div>
  );
}
