'use client';

import { useEffect } from 'react';
import { AppErrorState } from '@/components/ui/app-error-state';

type GlobalErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en" className="dark">
      <body>
        <AppErrorState
          message="O aplicativo encontrou um erro inesperado e interrompeu esta renderizacao."
          onRetry={reset}
        />
      </body>
    </html>
  );
}
