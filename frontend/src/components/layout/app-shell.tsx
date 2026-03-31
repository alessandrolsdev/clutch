'use client';

import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { SectionHeading } from '@/components/ui/section-heading';
import { useUiShellStore } from '@/store/ui-shell-store';
import type { FoundationCard } from '@/types/foundation';

type AppShellProps = {
  cards: FoundationCard[];
  children: ReactNode;
};

const roadmapItems = [
  'Design tokens and primitives',
  'Global dark theme and layout shell',
  'Auth bootstrap and route-safe API layer',
] as const;

export function AppShell({ cards, children }: AppShellProps) {
  const isRoadmapOpen = useUiShellStore((state) => state.isRoadmapOpen);
  const toggleRoadmap = useUiShellStore((state) => state.toggleRoadmap);

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div
        className="absolute inset-0 -z-10 bg-foundation-grid opacity-30 [background-size:56px_56px]"
        aria-hidden="true"
      />

      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-8 px-6 py-10 sm:px-10">
        <motion.header
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="flex flex-col gap-section rounded-surface border border-border bg-surface-primary p-card backdrop-blur"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <SectionHeading
              eyebrow="CLUTCH"
              title="CLUTCH frontend foundation"
              description="Tokens, primitives and shell patterns are aligned before product features start landing."
              level="h1"
            />

            <Button variant="secondary" size="sm" onClick={toggleRoadmap}>
              {isRoadmapOpen ? 'Hide roadmap' : 'Show roadmap'}
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {cards.map((card) => (
              <Card key={card.title} tone={card.tone}>
                <div className="flex flex-col gap-4">
                  <Badge tone={card.tone === 'accent' ? 'accent' : card.tone === 'success' ? 'success' : 'neutral'}>
                    Foundation
                  </Badge>
                  <div>
                    <h2 className="font-display text-xl font-medium text-primary">
                      {card.title}
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-secondary">
                      {card.description}
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </motion.header>

        {isRoadmapOpen ? (
          <Card className="border-dashed bg-surface-elevated">
            <p className="text-xs uppercase tracking-[0.35em] text-secondary">
              Foundation roadmap
            </p>
            <ul className="mt-4 grid gap-3 text-sm leading-6 text-secondary md:grid-cols-3">
              {roadmapItems.map((item) => (
                <li
                  key={item}
                  className="rounded-control border border-border bg-[rgba(10,10,15,0.6)] px-control-x py-control-y"
                >
                  {item}
                </li>
              ))}
            </ul>
          </Card>
        ) : null}

        {children}
      </div>
    </main>
  );
}
