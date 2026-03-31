import { AppShell } from '@/components/layout/app-shell';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { SectionHeading } from '@/components/ui/section-heading';
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
        <Card tone="accent" className="p-card shadow-glow">
          <div className="flex flex-col gap-section">
            <Badge tone="accent">Frontend setup</Badge>
            <SectionHeading
              title="CLUTCH frontend foundation is live."
              description="This is the smallest coherent shell we need before design tokens, layout, auth and product surfaces start landing. The backend demo seed is already available with the account clutchplayer@clutch.gg."
            />
          </div>
        </Card>

        <Card tone="default">
          <div className="flex flex-col gap-section">
            <p className="text-xs uppercase tracking-[0.35em] text-secondary">
              Next checkpoints
            </p>
            <ul className="space-y-4 text-sm leading-6 text-secondary">
              <li>Design tokens, dark theme and base primitives.</li>
              <li>Authenticated app shell with sidebar and top navigation.</li>
              <li>API wrapper, stores and route-safe contracts for product features.</li>
            </ul>
          </div>
        </Card>
      </section>
    </AppShell>
  );
}
