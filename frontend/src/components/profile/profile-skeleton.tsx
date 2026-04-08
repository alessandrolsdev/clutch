import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function ProfileSkeleton() {
  return (
    <div
      className="space-y-section"
      data-testid="profile-loading"
    >
      <Card className="p-0">
        <Skeleton className="h-40 w-full rounded-none" />
        <div className="space-y-4 p-card">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-5 w-72" />
          <Skeleton className="h-5 w-44" />
        </div>
      </Card>
      <Card>
        <Skeleton className="h-28 w-full" />
      </Card>
    </div>
  );
}
