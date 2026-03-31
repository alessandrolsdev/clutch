'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { FriendRequestCard } from '@/components/friends/friend-request-card';
import { FriendRequestsBadge } from '@/components/friends/friend-requests-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils/cn';
import { fetchPendingFriendRequests } from '@/services/friends';

type NavbarVariant = 'auth' | 'app';

type NavbarProps = {
  variant?: NavbarVariant;
  menuOpen?: boolean;
  onMenuToggle?: () => void;
};

function MenuIcon() {
  return (
    <span aria-hidden="true" className="flex flex-col gap-1">
      <span className="block h-0.5 w-4 rounded-full bg-current" />
      <span className="block h-0.5 w-4 rounded-full bg-current" />
      <span className="block h-0.5 w-4 rounded-full bg-current" />
    </span>
  );
}

function ActionButton({
  children,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn('min-w-0 px-3', className)}
      {...props}
    >
      {children}
    </Button>
  );
}

export function Navbar({
  variant = 'app',
  menuOpen = false,
  onMenuToggle,
}: NavbarProps) {
  const { user, status } = useAuth();
  const [isRequestsOpen, setIsRequestsOpen] = useState(false);
  const pendingRequestsQuery = useQuery({
    queryKey: ['friend-requests', user?.id],
    queryFn: () => fetchPendingFriendRequests(user?.id as string),
    enabled: variant === 'app' && status === 'authenticated' && typeof user?.id === 'string',
  });
  const pendingRequests = pendingRequestsQuery.data ?? [];

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-[rgba(10,10,15,0.88)] backdrop-blur">
      <div className="mx-auto flex w-full max-w-7xl items-center gap-3 px-page-x py-4">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {variant === 'app' ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="lg:hidden"
              onClick={onMenuToggle}
              aria-label={menuOpen ? 'Close sidebar' : 'Open sidebar'}
            >
              <MenuIcon />
            </Button>
          ) : null}

          <Link href="/" className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-control border border-border bg-background-tertiary font-display text-sm font-semibold tracking-[0.24em] text-primary">
              C
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="font-display text-lg font-semibold tracking-[0.18em] text-primary">
                CLUTCH
              </span>
              <span className="text-xs uppercase tracking-[0.3em] text-secondary">
                {variant === 'app' ? 'Authenticated shell' : 'Public entry'}
              </span>
            </span>
          </Link>
        </div>

        {variant === 'app' ? (
          <div className="hidden min-w-0 flex-1 items-center justify-center md:flex">
            <div className="w-full max-w-xl">
              <Input
                readOnly
                aria-label="Search placeholder"
                placeholder="Search profiles, posts and games"
              />
            </div>
          </div>
        ) : null}

        <div className="flex items-center gap-2">
          {variant === 'app' ? (
            <div className="relative">
              <ActionButton
                type="button"
                aria-label="Open friend requests preview"
                onClick={() => {
                  setIsRequestsOpen((current) => !current);
                }}
              >
                Requests
                <FriendRequestsBadge
                  count={pendingRequests.length}
                  isLoading={pendingRequestsQuery.isPending}
                />
              </ActionButton>

              {isRequestsOpen && status === 'authenticated' ? (
                <div className="absolute right-0 top-[calc(100%+0.75rem)] z-40 w-[22rem] max-w-[calc(100vw-2rem)]">
                  <Card>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <p className="text-xs uppercase tracking-[0.35em] text-secondary">
                          Pedidos
                        </p>
                        <h2 className="font-display text-xl font-semibold text-primary">
                          Friend requests
                        </h2>
                      </div>

                      {pendingRequestsQuery.isPending ? (
                        <p className="text-sm text-secondary">
                          Carregando pedidos pendentes...
                        </p>
                      ) : null}

                      {pendingRequestsQuery.isError ? (
                        <p className="text-sm text-status-afk">
                          Nao foi possivel carregar os pedidos pendentes.
                        </p>
                      ) : null}

                      {!pendingRequestsQuery.isPending &&
                      !pendingRequestsQuery.isError &&
                      pendingRequests.length === 0 ? (
                        <p className="text-sm text-secondary">
                          Nenhum pedido pendente no momento.
                        </p>
                      ) : null}

                      {pendingRequests.length > 0 ? (
                        <div className="space-y-3">
                          {pendingRequests.map((request) => (
                            <FriendRequestCard
                              key={request.id}
                              request={request}
                              receiverUserId={user?.id ?? ''}
                            />
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </Card>
                </div>
              ) : null}
            </div>
          ) : (
            <Badge tone="accent">No sidebar</Badge>
          )}
        </div>
      </div>
    </header>
  );
}
