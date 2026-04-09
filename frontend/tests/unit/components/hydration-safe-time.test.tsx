import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HydrationSafeTime } from '@/components/ui/hydration-safe-time';

describe('HydrationSafeTime', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders deterministic UTC content on the server and localizes after hydration', async () => {
    const formatterSpy = vi
      .spyOn(Intl, 'DateTimeFormat')
      .mockImplementation(((_locale?: string, options?: Intl.DateTimeFormatOptions) => {
        const timezone = options?.timeZone ?? 'LOCAL';

        return {
          format: () => `formatted:${timezone}`,
        } as Intl.DateTimeFormat;
      }) as typeof Intl.DateTimeFormat);

    const markup = renderToStaticMarkup(
      <HydrationSafeTime
        value="2026-04-09T12:00:00.000Z"
        options={{ dateStyle: 'short', timeStyle: 'short' }}
      />,
    );

    expect(markup).toContain('formatted:UTC');

    render(
      <HydrationSafeTime
        value="2026-04-09T12:00:00.000Z"
        options={{ dateStyle: 'short', timeStyle: 'short' }}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('formatted:LOCAL')).toBeInTheDocument();
    });

    expect(formatterSpy).toHaveBeenCalled();
  });

  it('falls back safely when the date is invalid', () => {
    render(
      <HydrationSafeTime
        value="data-invalida"
        fallback="Sem data valida"
        options={{ dateStyle: 'short' }}
      />,
    );

    expect(screen.getByText('Sem data valida')).toBeInTheDocument();
  });
});
