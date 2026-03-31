import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils/cn';

type PanelTone = 'accent' | 'neutral' | 'success';

type PanelProps = HTMLAttributes<HTMLDivElement> & {
  tone?: PanelTone;
};

const toneClassName: Record<PanelTone, string> = {
  accent: 'bg-[linear-gradient(160deg,rgba(124,58,237,0.18),rgba(10,10,15,0.92))]',
  neutral: 'bg-[rgba(26,26,39,0.9)]',
  success: 'bg-[linear-gradient(160deg,rgba(16,185,129,0.16),rgba(19,19,26,0.92))]',
};

export function Panel({
  className,
  tone = 'neutral',
  ...props
}: PanelProps) {
  return (
    <div
      className={cn(
        'rounded-[24px] border border-border p-6 backdrop-blur',
        toneClassName[tone],
        className,
      )}
      {...props}
    />
  );
}
