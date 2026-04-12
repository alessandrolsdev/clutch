import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function AppShellLoadingState() {
  return (
    <section
      className="space-y-section"
      data-testid="app-shell-loading-state"
      aria-label="Carregando conteudo do shell"
    >
      <Card>
        <div className="space-y-3">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-10 w-72" />
          <Skeleton className="h-5 w-full max-w-2xl" />
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.8fr)]">
        <div className="space-y-4">
          {Array.from({ length: 2 }).map((_, index) => (
            <Card key={index}>
              <Skeleton className="h-6 w-40" />
              <Skeleton className="mt-4 h-5 w-full" />
              <Skeleton className="mt-2 h-5 w-2/3" />
              <Skeleton className="mt-5 h-28 w-full" />
            </Card>
          ))}
        </div>

        <Card>
          <div className="space-y-4">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-28 w-full" />
          </div>
        </Card>
      </div>
    </section>
  );
}
