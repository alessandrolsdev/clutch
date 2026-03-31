'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils/cn';

const navItems = [
  {
    href: '/settings',
    label: 'Perfil',
    description: 'Edicao visual do seu GamerCard.',
  },
  {
    href: '/settings/integrations',
    label: 'Integracoes',
    description: 'Steam, Epic e busca IGDB.',
  },
] as const;

export function SettingsNav() {
  const pathname = usePathname();

  return (
    <Card className="p-3">
      <div className="grid gap-3 sm:grid-cols-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-start justify-between gap-4 rounded-control border px-control-x py-control-y transition',
                isActive
                  ? 'border-accent-cyan/40 bg-[rgba(6,182,212,0.1)] text-primary'
                  : 'border-border bg-background-secondary text-secondary hover:text-primary',
              )}
            >
              <span className="space-y-1">
                <span className="block font-medium">{item.label}</span>
                <span className="block text-xs leading-5 text-secondary">
                  {item.description}
                </span>
              </span>
              {isActive ? <Badge tone="accent">Ativa</Badge> : null}
            </Link>
          );
        })}
      </div>
    </Card>
  );
}
