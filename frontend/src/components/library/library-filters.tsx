import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils/cn';

export type LibrarySortOption = 'most-played' | 'recent' | 'alphabetical';

type LibraryFiltersProps = {
  platforms: string[];
  selectedPlatform: string;
  selectedSort: LibrarySortOption;
  onPlatformChange: (platform: string) => void;
  onSortChange: (sort: LibrarySortOption) => void;
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
}: LibraryFiltersProps) {
  return (
    <Card className="space-y-4">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.35em] text-secondary">Filtros</p>
        <div className="flex flex-wrap gap-2">
          {platforms.map((platform) => {
            const isActive = selectedPlatform === platform;

            return (
              <button
                key={platform}
                type="button"
                className={cn(
                  'inline-flex items-center rounded-pill border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.24em] transition',
                  isActive
                    ? 'border-accent-cyan/40 bg-[rgba(6,182,212,0.1)] text-primary'
                    : 'border-border bg-background-secondary text-secondary hover:text-primary',
                )}
                onClick={() => {
                  onPlatformChange(platform);
                }}
              >
                {platform === 'ALL' ? 'Todas' : platform}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="accent">Ordenacao</Badge>
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
    </Card>
  );
}
