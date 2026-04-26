'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils/cn';
import { useAuth } from '@/hooks/use-auth';

type SidebarProps = {
  isOpen: boolean;
  onClose: () => void;
  className?: string;
};

type SidebarItem = {
  label: string;
  description: string;
  href?: string;
  tone?: 'accent' | 'neutral';
  unavailableReason?: string;
};

function SidebarNavItem({ item, onNavigate }: { item: SidebarItem; onNavigate: () => void }) {
  if (!item.href) {
    return (
      <div
        aria-disabled="true"
        className="flex w-full items-start justify-between gap-4 rounded-control border border-dashed border-border px-control-x py-control-y text-left text-secondary opacity-80"
      >
        <span className="flex flex-col gap-1">
          <span className="font-medium text-inherit">{item.label}</span>
          <span className="text-xs leading-5 text-secondary">
            {item.unavailableReason ?? item.description}
          </span>
        </span>
        <Badge tone="neutral">Em breve</Badge>
      </div>
    );
  }

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cn(
        'flex w-full items-start justify-between gap-4 rounded-control border px-control-x py-control-y text-left transition',
        item.tone === 'accent'
          ? 'border-accent-cyan/40 bg-[rgba(124,58,237,0.14)] text-primary'
          : 'border-border bg-[rgba(26,26,39,0.74)] text-secondary hover:text-primary',
      )}
    >
      <span className="flex flex-col gap-1">
        <span className="font-medium text-inherit">{item.label}</span>
        <span className="text-xs leading-5 text-secondary">{item.description}</span>
      </span>
      {item.tone === 'accent' ? <Badge tone="accent">Ativa</Badge> : null}
    </Link>
  );
}

export function Sidebar({ isOpen, onClose, className }: SidebarProps) {
  const pathname = usePathname();
  const { user, status, logout } = useAuth();

  const displayUser = user ?? {
    id: 'demo-user',
    username: 'clutchplayer',
    email: 'clutchplayer@clutch.gg',
  };

  const sidebarItems: SidebarItem[] = [
    {
      label: 'Feed',
      href: '/feed',
      tone: pathname === '/feed' ? 'accent' : 'neutral',
      description: 'Timeline and creator activity',
    },
    {
      label: 'Profile',
      href: status === 'authenticated' ? `/${displayUser.username}` : undefined,
      tone:
        status === 'authenticated' && pathname === `/${displayUser.username}`
          ? 'accent'
          : 'neutral',
      description: 'GamerCard and public stats',
      unavailableReason:
        status === 'authenticated' ? undefined : 'Disponivel apos a sessao ser restaurada.',
    },
    {
      label: 'Friends',
      description: 'Requests and presence ordering',
      unavailableReason: 'Ainda nao existe uma pagina dedicada de amigos nesta superficie.',
    },
    {
      label: 'Communities',
      href: '/communities',
      tone: pathname.startsWith('/communities') ? 'accent' : 'neutral',
      description: 'Public guilds and basic membership',
    },
    {
      label: 'Notifications',
      href: '/notifications',
      tone: pathname === '/notifications' ? 'accent' : 'neutral',
      description: 'Unread activity and alerts',
    },
    {
      label: 'Settings',
      href: '/settings',
      tone: pathname.startsWith('/settings') ? 'accent' : 'neutral',
      description: 'Profile, integrations and library',
    },
  ];

  const sessionLabel =
    status === 'authenticated'
      ? 'Sessão ativa'
      : status === 'loading'
        ? 'Restaurando sessão'
        : 'Sessão offline';

  const logoutLabel = status === 'authenticated' ? 'Sair' : 'Aguardando sessão';

  return (
    <>
      <button
        type="button"
        className={cn(
          'fixed inset-0 z-30 bg-black/60 transition lg:hidden',
          isOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        aria-hidden="true"
        tabIndex={-1}
        onClick={onClose}
      />

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-[18rem] max-w-[85vw] translate-x-[-100%] flex-col border-r border-border bg-[rgba(10,10,15,0.96)] px-5 py-6 transition-transform duration-300 lg:sticky lg:top-[4.5rem] lg:z-0 lg:h-[calc(100vh-4.5rem)] lg:translate-x-0 lg:bg-transparent lg:px-0 lg:py-0',
          isOpen && 'translate-x-0',
          className,
        )}
        data-open={isOpen}
        aria-label="Primary sidebar"
      >
        <div className="flex h-full flex-col gap-section rounded-surface border border-border bg-surface-primary p-card shadow-glow lg:sticky lg:top-6">
          <div className="flex items-start justify-between gap-3 lg:hidden">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-secondary">
                Navigation
              </p>
              <h2 className="mt-2 font-display text-xl font-semibold text-primary">
                CLUTCH
              </h2>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close sidebar">
              Close
            </Button>
          </div>

          <div className="flex flex-col gap-3">
            {sidebarItems.map((item) => (
              <SidebarNavItem key={item.label} item={item} onNavigate={onClose} />
            ))}
          </div>

          <Card className="mt-auto" tone="neutral">
            <div className="flex items-start gap-4">
              <Avatar
                alt={displayUser.username}
                fallback={displayUser.username.slice(0, 2).toUpperCase()}
                size="lg"
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs uppercase tracking-[0.35em] text-secondary">
                  Connected user
                </p>
                <h3 className="mt-2 truncate font-display text-xl font-semibold text-primary">
                  {displayUser.username}
                </h3>
                <p className="truncate text-sm text-secondary">{displayUser.email}</p>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-2">
              <Badge tone={status === 'authenticated' ? 'success' : 'neutral'}>
                {sessionLabel}
              </Badge>
              <Badge tone="neutral">httpOnly cookie</Badge>
            </div>

            <p className="mt-4 text-sm leading-6 text-secondary">
              A sessão é hidratada do cookie do backend sem expor JWT no browser.
            </p>

            <div className="mt-4 flex items-center justify-between gap-3">
              <span className="text-xs uppercase tracking-[0.35em] text-secondary">
                {logoutLabel}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => void logout()}
                disabled={status !== 'authenticated'}
              >
                Sair
              </Button>
            </div>
          </Card>
        </div>
      </aside>
    </>
  );
}
