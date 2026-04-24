'use client';

import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { SectionHeading } from '@/components/ui/section-heading';
import { type ProfileResponse } from '@/schemas/profile';

type OtakuShowcaseCardProps = {
  showcase: ProfileResponse['otakuShowcase'];
};

function formatCount(value: number, singular: string, plural: string): string {
  const normalizedValue = value.toLocaleString('pt-BR');
  return `${normalizedValue} ${value === 1 ? singular : plural}`;
}

export function OtakuShowcaseCard({ showcase }: OtakuShowcaseCardProps) {
  if (!showcase) {
    return (
      <Card data-testid="otaku-showcase-card">
        <div className="space-y-5">
          <SectionHeading
            eyebrow="Anime e manga"
            title="Showcase otaku"
            description="Espaco reservado para obras destacadas e consumo publico quando o usuario decidir expor esse repertorio no perfil."
          />

          <div
            data-testid="otaku-showcase-empty"
            className="rounded-control border border-border bg-background-tertiary/65 px-4 py-4 text-sm text-secondary"
          >
            <p className="font-medium text-primary">
              Ainda nao ha showcase anime/manga publico neste perfil.
            </p>
            <p className="mt-2 leading-6">
              Quando o usuario destacar obras ou consumo atual de forma explicita, esse resumo
              aparece aqui sem abrir uma watchlist completa.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card data-testid="otaku-showcase-card">
      <div className="space-y-5">
        <SectionHeading
          eyebrow="Anime e manga"
          title="Showcase otaku"
          description="Recorte publico de obras e consumo atual que complementa a identidade gamer sem dominar o perfil."
        />

        <div className="flex flex-wrap gap-2">
          <Badge tone="neutral">
            {formatCount(showcase.featured.length, 'destaque publico', 'destaques publicos')}
          </Badge>
          <Badge tone="neutral">
            {formatCount(showcase.consumingCount, 'obra em consumo', 'obras em consumo')}
          </Badge>
          <Badge tone="neutral">
            {formatCount(showcase.completedCount, 'obra concluida', 'obras concluidas')}
          </Badge>
        </div>

        <ul className="grid gap-3 sm:grid-cols-3">
          {showcase.featured.map((item) => (
            <li
              key={item.id}
              data-testid="otaku-showcase-featured-item"
              className="overflow-hidden rounded-control border border-border bg-background-tertiary/70"
            >
              <div className="relative h-36 w-full">
                {item.coverUrl ? (
                  <Image
                    src={item.coverUrl}
                    alt={item.title}
                    fill
                    sizes="(min-width: 640px) 33vw, 100vw"
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-background-primary text-xs uppercase tracking-[0.25em] text-secondary">
                    Sem capa
                  </div>
                )}
              </div>

              <div className="space-y-3 px-4 py-4">
                <Badge tone="neutral">{item.kind}</Badge>
                <p className="line-clamp-2 text-sm font-semibold leading-6 text-primary">
                  {item.title}
                </p>
              </div>
            </li>
          ))}
        </ul>

        <div
          data-testid="otaku-showcase-consuming"
          className="rounded-control border border-border bg-background-secondary/50 px-4 py-4"
        >
          <p className="text-xs uppercase tracking-[0.3em] text-secondary">Consumindo agora</p>
          <p className="mt-2 text-sm leading-6 text-secondary">
            {showcase.consumingNow.length > 0
              ? showcase.consumingNow.map((item) => item.title).join(', ')
              : 'Sem obra em consumo publico neste momento.'}
          </p>
        </div>
      </div>
    </Card>
  );
}
