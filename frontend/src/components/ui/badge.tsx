import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

type BadgeTone = 'neutral' | 'accent' | 'success' | 'warning';

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: BadgeTone;
  children: ReactNode;
};

const toneClassName: Record<BadgeTone, string> = {
  neutral: 'border-border bg-[var(--badge-background)] text-secondary',
  accent: 'border-[rgba(124,58,237,0.25)] bg-[var(--badge-background-accent)] text-accent-purple',
  success: 'border-[rgba(16,185,129,0.24)] bg-[var(--badge-background-success)] text-status-online',
  warning: 'border-[rgba(245,158,11,0.24)] bg-[var(--badge-background-warning)] text-status-afk',
};

export function Badge({ children, className, tone = 'neutral', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-pill border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.24em]',
        toneClassName[tone],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
