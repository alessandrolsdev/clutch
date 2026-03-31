import { Card } from '@/components/ui/card';
import { type ProfileResponse } from '@/schemas/profile';

type ProfileStatsProps = {
  stats: ProfileResponse['stats'];
};

type StatItem = {
  label: string;
  value: number;
};

export function ProfileStats({ stats }: ProfileStatsProps) {
  const items: StatItem[] = [
    { label: 'Amigos', value: stats.friendCount },
    { label: 'Posts', value: stats.postCount },
    { label: 'Reputacao', value: stats.reputation },
    { label: 'Nivel', value: stats.level },
    { label: 'XP', value: stats.xp },
  ];

  return (
    <Card>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {items.map((item) => (
          <div
            key={item.label}
            className="rounded-control border border-border bg-background-tertiary/70 px-4 py-3"
          >
            <p className="text-xs uppercase tracking-[0.3em] text-secondary">
              {item.label}
            </p>
            <p className="mt-2 font-display text-xl font-semibold text-primary">
              {item.value.toLocaleString('pt-BR')}
            </p>
          </div>
        ))}
      </div>
    </Card>
  );
}
