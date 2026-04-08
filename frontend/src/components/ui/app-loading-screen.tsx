import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function AppLoadingScreen() {
  return (
    <main
      className="min-h-screen bg-background-primary px-6 py-10 text-primary"
      data-testid="app-loading-screen"
    >
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <Card>
          <div className="space-y-3">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-10 w-80" />
            <Skeleton className="h-5 w-full max-w-2xl" />
          </div>
        </Card>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <div className="space-y-4">
              <Skeleton className="h-8 w-44" />
              <Skeleton className="h-24 w-full" />
            </div>
          </Card>
          <Card>
            <div className="space-y-4">
              <Skeleton className="h-8 w-36" />
              <Skeleton className="h-24 w-full" />
            </div>
          </Card>
        </div>
      </div>
    </main>
  );
}
