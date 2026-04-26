'use client';

import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import type { Community } from '@/schemas/communities';

type CommunityCardProps = {
  community: Community;
};

export function CommunityCard({ community }: CommunityCardProps) {
  const ownerLabel = community.owner.displayName ?? community.owner.username;

  return (
    <Card className="flex h-full flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.35em] text-secondary">
            Comunidade pública
          </p>
          <Link
            href={`/communities/${community.slug}`}
            className="mt-2 block font-display text-2xl font-semibold text-primary transition hover:text-accent-cyan"
          >
            {community.name}
          </Link>
        </div>
        <Badge tone="success">{community.memberCount} membros</Badge>
      </div>

      <p className="line-clamp-3 text-sm leading-6 text-secondary">
        {community.description ??
          'Espaço público para reunir jogadores em torno de um interesse compartilhado.'}
      </p>

      <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <span className="text-xs uppercase tracking-[0.28em] text-secondary">
          Owner: {ownerLabel}
        </span>
        <Link
          href={`/communities/${community.slug}`}
          className="text-sm font-medium text-accent-cyan transition hover:text-primary"
        >
          Ver comunidade
        </Link>
      </div>
    </Card>
  );
}
