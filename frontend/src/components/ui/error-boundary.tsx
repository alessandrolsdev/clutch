'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AppErrorState } from '@/components/ui/app-error-state';

type ErrorBoundaryProps = {
  children: ReactNode;
  fallback?: ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
};

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  public constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
    };
  }

  public static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  public componentDidCatch(_error: Error, _errorInfo: ErrorInfo) {}

  public render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <AppErrorState message="O componente falhou ao renderizar." />
      );
    }

    return this.props.children;
  }
}
