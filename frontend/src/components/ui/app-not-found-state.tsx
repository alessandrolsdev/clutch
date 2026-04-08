import Link from 'next/link';
import { Card } from '@/components/ui/card';

export function AppNotFoundState() {
  return (
    <main
      className="min-h-screen bg-background-primary px-6 py-10 text-primary"
      data-testid="app-not-found-state"
    >
      <div className="mx-auto flex w-full max-w-3xl items-center justify-center">
        <Card className="w-full max-w-2xl">
          <div className="space-y-4">
            <p className="text-xs uppercase tracking-[0.35em] text-secondary">
              Erro 404
            </p>
            <h1 className="font-display text-4xl font-semibold text-primary">
              GG EZ — Pagina nao encontrada
            </h1>
            <p className="text-sm leading-6 text-secondary">
              O caminho pedido nao existe no estado atual do produto ou nao esta
              disponivel para esta sessao.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/feed"
                className="inline-flex h-11 items-center justify-center rounded-control border border-transparent bg-accent-purple px-control-x text-sm font-medium text-white transition hover:brightness-110"
              >
                Voltar ao feed
              </Link>
              <Link
                href="/"
                className="inline-flex h-11 items-center justify-center rounded-control border border-border bg-[var(--button-background)] px-control-x text-sm font-medium text-primary transition hover:border-accent-cyan hover:bg-[var(--button-background-hover)] hover:text-accent-cyan"
              >
                Ir para a home
              </Link>
            </div>
          </div>
        </Card>
      </div>
    </main>
  );
}
