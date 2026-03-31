import { AppShell } from '@/components/layout/app-shell';
import type { FoundationCard } from '@/types/foundation';

const foundationCards: FoundationCard[] = [
  {
    title: 'Next.js 15 App Router',
    description: 'Base application shell ready for auth, layout and feature routes.',
    tone: 'accent',
  },
  {
    title: 'Strict TypeScript',
    description: 'Zero-any policy, aliases and future-safe folder boundaries are in place.',
    tone: 'neutral',
  },
  {
    title: 'Backend Ready',
    description: 'The demo account and hardened backend contracts are ready for the next frontend issues.',
    tone: 'success',
  },
];

export default function HomePage() {
  return (
    <AppShell cards={foundationCards}>
      <section className="grid gap-4 lg:grid-cols-[1.35fr_0.95fr]">
        <div className="rounded-[28px] border border-border bg-[rgba(19,19,26,0.85)] p-8 shadow-glow">
          <p className="text-xs uppercase tracking-[0.35em] text-secondary">
            Frontend setup
          </p>
          <h1 className="mt-4 font-display text-4xl font-semibold tracking-tight text-primary sm:text-5xl">
            CLUTCH frontend foundation is live.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-secondary">
            This is the smallest coherent shell we need before design tokens, layout,
            auth and product surfaces start landing. The backend demo seed is already
            available with the account <span className="accent-cyan">clutchplayer@clutch.gg</span>.
          </p>
        </div>

        <div className="rounded-[28px] border border-border bg-[rgba(26,26,39,0.9)] p-8">
          <p className="text-xs uppercase tracking-[0.35em] text-secondary">
            Next checkpoints
          </p>
          <ul className="mt-5 space-y-4 text-sm leading-6 text-secondary">
            <li>Design tokens, dark theme and base primitives.</li>
            <li>Authenticated app shell with sidebar and top navigation.</li>
            <li>API wrapper, stores and route-safe contracts for product features.</li>
          </ul>
        </div>
      </section>
    </AppShell>
  );
}
