import Link from 'next/link';
import { LandingPreview } from '@/components/landing/landing-preview';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { SectionHeading } from '@/components/ui/section-heading';

const featureHighlights = [
  {
    eyebrow: 'Presenca',
    title: 'Rich Presence em tempo real',
    description:
      'Sua sessao conecta feed, amizades e status em uma unica superficie do produto.',
  },
  {
    eyebrow: 'Biblioteca',
    title: 'Jogos em um perfil unificado',
    description:
      'Steam, Epic e enrichment atual do backend aparecem no mesmo perfil e na mesma library.',
  },
  {
    eyebrow: 'Social',
    title: 'Feed, amizades e notificacoes',
    description:
      'As interacoes sociais reais do MVP ja vivem no mesmo shell autenticado do frontend.',
  },
];

export function LandingPageContent() {
  return (
    <section className="w-full space-y-8 md:space-y-10" data-testid="landing-page">
      <Card
        tone="accent"
        className="overflow-hidden border-[rgba(124,58,237,0.22)] bg-[rgba(10,10,15,0.82)] shadow-glow"
      >
        <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div className="space-y-6">
            <Badge tone="accent">CLUTCH beta</Badge>

            <SectionHeading
              level="h1"
              eyebrow="Identidade gamer"
              title="Revele sua verdadeira identidade"
              description="Conecte suas plataformas, centralize sua biblioteca e entre em um produto social feito para perfil, feed, amizades e presenca em tempo real."
            />

            <div className="flex flex-wrap gap-3">
              <Link
                href="/register"
                className="inline-flex h-11 items-center justify-center rounded-control border border-transparent bg-accent-purple px-control-x text-sm font-medium text-white transition hover:brightness-110"
              >
                Criar conta gratis
              </Link>
              <Link
                href="/login"
                className="inline-flex h-11 items-center justify-center rounded-control border border-border bg-[rgba(19,19,26,0.88)] px-control-x text-sm font-medium text-primary transition hover:border-accent-cyan hover:text-accent-cyan"
              >
                Ver demo
              </Link>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-control border border-border bg-background-primary/70 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.28em] text-secondary">
                  Stack
                </p>
                <p className="mt-2 text-sm font-medium text-primary">
                  Frontend, backend e realtime sob o mesmo proxy
                </p>
              </div>
              <div className="rounded-control border border-border bg-background-primary/70 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.28em] text-secondary">
                  Sessao
                </p>
                <p className="mt-2 text-sm font-medium text-primary">
                  Auth endurecido com refresh, revogacao e hardening recente
                </p>
              </div>
              <div className="rounded-control border border-border bg-background-primary/70 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.28em] text-secondary">
                  Produto
                </p>
                <p className="mt-2 text-sm font-medium text-primary">
                  Perfil, feed, library e integracoes em evolucao real
                </p>
              </div>
            </div>
          </div>

          <LandingPreview />
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        {featureHighlights.map((feature) => (
          <Card key={feature.title} className="h-full">
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-[0.35em] text-secondary">
                {feature.eyebrow}
              </p>
              <h2 className="font-display text-2xl font-semibold text-primary">
                {feature.title}
              </h2>
              <p className="text-sm leading-6 text-secondary">
                {feature.description}
              </p>
            </div>
          </Card>
        ))}
      </div>

      <Card className="border-[rgba(6,182,212,0.18)] bg-[rgba(19,19,26,0.82)]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.35em] text-secondary">
              Proximo passo
            </p>
            <h2 className="font-display text-3xl font-semibold text-primary">
              Entre agora e conecte seu perfil ao CLUTCH
            </h2>
            <p className="max-w-2xl text-sm leading-6 text-secondary">
              A entrada publica continua simples, mas o shell autenticado ja
              sustenta os fluxos centrais do MVP. O melhor caminho para ver o
              produto e abrir a sessao real do ambiente atual.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/register"
              className="inline-flex h-11 items-center justify-center rounded-control border border-transparent bg-accent-cyan px-control-x text-sm font-medium text-background-primary transition hover:brightness-110"
            >
              Comecar agora
            </Link>
            <Link
              href="/login"
              className="inline-flex h-11 items-center justify-center rounded-control border border-border bg-transparent px-control-x text-sm font-medium text-primary transition hover:border-accent-cyan hover:text-accent-cyan"
            >
              Entrar com conta existente
            </Link>
          </div>
        </div>
      </Card>
    </section>
  );
}
