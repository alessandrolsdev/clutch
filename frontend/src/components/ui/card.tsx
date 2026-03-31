import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

type CardTone = 'default' | 'neutral' | 'accent' | 'success';

export type CardProps = HTMLAttributes<HTMLDivElement> & {
  tone?: CardTone;
  children: ReactNode;
};

const toneStyle: Record<CardTone, CSSProperties> = {
  default: { backgroundColor: 'var(--card-background)' },
  neutral: { backgroundColor: 'var(--card-background)' },
  accent: { backgroundImage: 'var(--card-background-accent)' },
  success: { backgroundImage: 'var(--card-background-success)' },
};

export function Card({ children, className, tone = 'default', ...props }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-surface border border-border p-card backdrop-blur',
        className,
      )}
      style={toneStyle[tone]}
      {...props}
    >
      {children}
    </div>
  );
}
