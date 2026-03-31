import type { ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

type HeadingLevel = 'h1' | 'h2' | 'h3';

type SectionHeadingProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
  level?: HeadingLevel;
};

export function SectionHeading({
  eyebrow,
  title,
  description,
  actions,
  className,
  level = 'h2',
}: SectionHeadingProps) {
  const HeadingTag = level;

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          {eyebrow ? (
            <p className="text-xs uppercase tracking-[0.4em] text-secondary">
              {eyebrow}
            </p>
          ) : null}
          <HeadingTag className="mt-2 font-display text-2xl font-semibold tracking-tight text-primary sm:text-3xl">
            {title}
          </HeadingTag>
          {description ? (
            <p className="mt-3 max-w-2xl text-sm leading-6 text-secondary">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}
