import Image from 'next/image';
import { useState, type HTMLAttributes } from 'react';
import { cn } from '@/lib/utils/cn';

type AvatarSize = 'sm' | 'md' | 'lg';

type AvatarProps = HTMLAttributes<HTMLDivElement> & {
  src?: string | null;
  alt: string;
  fallback: string;
  size?: AvatarSize;
};

const sizeClassName: Record<AvatarSize, string> = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
};

const sizeDimension: Record<AvatarSize, number> = {
  sm: 32,
  md: 40,
  lg: 48,
};

export function Avatar({
  alt,
  fallback,
  className,
  size = 'md',
  src,
  ...props
}: AvatarProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const shouldRenderImage = Boolean(src) && !imageFailed;
  const shouldUseNextImage = typeof src === 'string' && src.startsWith('https://images.igdb.com');

  return (
    <div
      className={cn(
        'inline-flex items-center justify-center overflow-hidden rounded-full border border-border bg-background-tertiary text-primary',
        sizeClassName[size],
        className,
      )}
      {...props}
    >
      {shouldRenderImage ? (
        shouldUseNextImage ? (
          <Image
            src={src as string}
            alt={alt}
            width={sizeDimension[size]}
            height={sizeDimension[size]}
            className="h-full w-full object-cover"
            onError={() => {
              setImageFailed(true);
            }}
          />
        ) : (
          // Avatar precisa aceitar URLs remotas genericas que o backend ja persiste hoje.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src ?? undefined}
            alt={alt}
            className="h-full w-full object-cover"
            loading="lazy"
            onError={() => {
              setImageFailed(true);
            }}
          />
        )
      ) : (
        <span aria-hidden="true" className="font-semibold">
          {fallback}
        </span>
      )}
    </div>
  );
}
