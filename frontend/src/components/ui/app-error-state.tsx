'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

type AppErrorStateProps = {
  message?: string;
  onRetry?: () => void;
};

export function AppErrorState({
  message = 'Tente novamente em alguns instantes.',
  onRetry,
}: AppErrorStateProps) {
  return (
    <main
      className="min-h-screen bg-background-primary px-6 py-10 text-primary"
      data-testid="app-error-state"
    >
      <div className="mx-auto flex w-full max-w-3xl items-center justify-center">
        <Card className="w-full max-w-2xl">
          <div className="space-y-4">
            <p className="text-xs uppercase tracking-[0.35em] text-secondary">
              Erro global
            </p>
            <h1 className="font-display text-4xl font-semibold text-primary">
              Algo saiu do fluxo esperado
            </h1>
            <p className="text-sm leading-6 text-secondary">{message}</p>
            {onRetry ? (
              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={() => {
                    onRetry();
                  }}
                >
                  Tentar novamente
                </Button>
              </div>
            ) : null}
          </div>
        </Card>
      </div>
    </main>
  );
}
