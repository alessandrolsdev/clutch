'use client';

import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { Panel } from '@/components/ui/panel';
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
          className="flex flex-col gap-5 rounded-[32px] border border-border bg-[rgba(19,19,26,0.75)] p-8 backdrop-blur"
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-secondary">
                CLUTCH
              </p>
              <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight text-primary sm:text-4xl">
                CLUTCH frontend foundation
              </h1>
            </div>

            <button
              type="button"
              onClick={toggleRoadmap}
              className="rounded-full border border-border bg-background-tertiary px-4 py-2 text-sm font-medium text-primary transition hover:border-[var(--accent-cyan)] hover:text-[var(--accent-cyan)]"
            >
              {isRoadmapOpen ? 'Hide roadmap' : 'Show roadmap'}
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {cards.map((card) => (
              <Panel key={card.title} tone={card.tone}>
                <h2 className="font-display text-xl font-medium text-primary">
                  {card.title}
                </h2>
                <p className="mt-2 text-sm leading-6 text-secondary">
                  {card.description}
                </p>
              </Panel>
            ))}
          </div>
        </motion.header>

        {isRoadmapOpen ? (
          <Panel className="border-dashed bg-[rgba(26,26,39,0.8)]">
            <p className="text-xs uppercase tracking-[0.35em] text-secondary">
              Foundation roadmap
            </p>
            <ul className="mt-4 grid gap-3 text-sm leading-6 text-secondary md:grid-cols-3">
              {roadmapItems.map((item) => (
                <li
                  key={item}
                  className="rounded-2xl border border-border bg-[rgba(10,10,15,0.55)] px-4 py-3"
                >
                  {item}
                </li>
              ))}
            </ul>
          </Panel>
        ) : null}

        {children}
      </div>
    </main>
  );
}
