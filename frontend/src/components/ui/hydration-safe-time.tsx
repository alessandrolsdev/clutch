'use client';

import { useEffect, useMemo, useState } from 'react';

type HydrationSafeTimeProps = {
  value: string;
  locale?: string;
  options: Intl.DateTimeFormatOptions;
  fallback?: string;
  className?: string;
};

function parseDate(value: string): Date | null {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

function formatDate(
  value: Date,
  locale: string,
  options: Intl.DateTimeFormatOptions,
): string {
  return new Intl.DateTimeFormat(locale, options).format(value);
}

export function HydrationSafeTime({
  value,
  locale = 'pt-BR',
  options,
  fallback,
  className,
}: HydrationSafeTimeProps) {
  const [hydrated, setHydrated] = useState(false);
  const parsedDate = useMemo(() => parseDate(value), [value]);

  useEffect(() => {
    setHydrated(true);
  }, []);

  if (!parsedDate) {
    const safeFallback = fallback ?? value;

    return (
      <time suppressHydrationWarning className={className}>
        {safeFallback}
      </time>
    );
  }

  const initialLabel = formatDate(parsedDate, locale, {
    ...options,
    timeZone: 'UTC',
  });
  const hydratedLabel = hydrated ? formatDate(parsedDate, locale, options) : initialLabel;

  return (
    <time
      suppressHydrationWarning
      className={className}
      dateTime={parsedDate.toISOString()}
    >
      {hydratedLabel}
    </time>
  );
}
