import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils/cn';

export type LibrarySortOption = 'most-played' | 'recent' | 'alphabetical';

type LibraryFiltersProps = {
  platforms: Array<{
    value: string;
    count: number;
  }>;
  selectedPlatform: string;
  selectedSort: LibrarySortOption;
  onPlatformChange: (platform: string) => void;
  onSortChange: (sort: LibrarySortOption) => void;
  onReset: () => void;
  hasActiveRefinements: boolean;
};

const sortOptions: Array<{ value: LibrarySortOption; label: string }> = [
  { value: 'most-played', label: 'Mais jogados' },
  { value: 'recent', label: 'Mais recentes' },
  { value: 'alphabetical', label: 'Alfabetica' },
];

export function LibraryFilters({
  platforms,
  selectedPlatform,
  selectedSort,
  onPlatformChange,
  onSortChange,
  onReset,
  hasActiveRefinements,
}: LibraryFiltersProps) {
  return (
    <Card className="space-y-5 xl:sticky xl:top-24">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs uppercase tracking-[0.35em] text-secondary">Refinar vista</p>
          <Button
            variant="ghost"
            size="sm"
            disabled={!hasActiveRefinements}
            onClick={onReset}
          >
            Limpar tudo
          </Button>
        </div>
        <p className="text-sm leading-6 text-secondary">
          Ajuste plataforma e ordenação sem alterar o contrato do profile.
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.35em] text-secondary">Plataforma</p>
        <div className="flex flex-wrap gap-2">
          {platforms.map((platform) => {
            const isActive = selectedPlatform === platform.value;

            return (
              <button
                key={platform.value}
                type="button"
                className={cn(
                  'inline-flex items-center rounded-pill border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.24em] transition',
                  isActive
                    ? 'border-accent-cyan/40 bg-[rgba(6,182,212,0.1)] text-primary'
                    : 'border-border bg-background-secondary text-secondary hover:text-primary',
                )}
                onClick={() => {
                  onPlatformChange(platform.value);
                }}
              >
                {platform.value === 'ALL' ? 'Todas' : platform.value} ({platform.count})
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="accent">Ordenação</Badge>
          <p className="text-sm text-secondary">Defina como a lista deve ganhar prioridade.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {sortOptions.map((option) => (
            <Button
              key={option.value}
              type="button"
              size="sm"
              variant={selectedSort === option.value ? 'primary' : 'secondary'}
              onClick={() => {
                onSortChange(option.value);
              }}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>
    </Card>
  );
}
