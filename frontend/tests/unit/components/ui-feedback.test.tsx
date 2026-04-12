import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AppErrorState } from '@/components/ui/app-error-state';
import { AppLoadingScreen } from '@/components/ui/app-loading-screen';
import { AppNotFoundState } from '@/components/ui/app-not-found-state';
import { AppShellLoadingState } from '@/components/layout/app-shell-loading-state';
import { ErrorBoundary } from '@/components/ui/error-boundary';
import { ToastProvider, useToast } from '@/components/ui/toaster';

function ToastTrigger() {
  const { showToast } = useToast();

  return (
    <button
      type="button"
      onClick={() => {
        showToast({
          title: 'Acao concluida',
          description: 'Feedback global renderizado.',
          tone: 'success',
        });
      }}
    >
      disparar
    </button>
  );
}

function BrokenComponent(): React.JSX.Element {
  throw new Error('render failed');
}

describe('UI feedback foundation', () => {
  it('renders the global loading screen', () => {
    render(<AppLoadingScreen />);

    expect(screen.getByTestId('app-loading-screen')).toBeInTheDocument();
  });

  it('renders the shell-local loading state', () => {
    render(<AppShellLoadingState />);

    expect(screen.getByTestId('app-shell-loading-state')).toBeInTheDocument();
  });

  it('renders the global not found state', () => {
    render(<AppNotFoundState />);

    expect(screen.getByTestId('app-not-found-state')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /voltar ao feed/i })).toHaveAttribute(
      'href',
      '/feed',
    );
  });

  it('renders the global error state and retries', () => {
    let retryCount = 0;

    render(
      <AppErrorState
        message="Falha controlada."
        onRetry={() => {
          retryCount += 1;
        }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /tentar novamente/i }));

    expect(retryCount).toBe(1);
  });

  it('shows fallback through the reusable error boundary', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <BrokenComponent />
      </ErrorBoundary>,
    );

    expect(screen.getByTestId('app-error-state')).toBeInTheDocument();

    spy.mockRestore();
  });

  it('renders global toasts through the provider', () => {
    render(
      <ToastProvider>
        <ToastTrigger />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: /disparar/i }));

    expect(screen.getByTestId('toast-item')).toHaveTextContent(/acao concluida/i);
    expect(screen.getByTestId('toast-item')).toHaveTextContent(
      /feedback global renderizado/i,
    );
  });
});
