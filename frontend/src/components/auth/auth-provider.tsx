'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { isProtectedPath, isPublicEntryPath } from '@/lib/auth/routes';
import { fetchAuthSession } from '@/services/session';
import { useAuthStore } from '@/store/auth-store';

type AuthProviderProps = Readonly<{
  children: ReactNode;
}>;

export function AuthProvider({ children }: AuthProviderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const bootstrapped = useRef(false);
  const status = useAuthStore((state) => state.status);
  const clearSession = useAuthStore((state) => state.clearSession);
  const setLoading = useAuthStore((state) => state.setLoading);
  const setSession = useAuthStore((state) => state.setSession);

  useEffect(() => {
    let isActive = true;

    if (bootstrapped.current) {
      return undefined;
    }

    bootstrapped.current = true;
    setLoading();

    void (async () => {
      const session = await fetchAuthSession();

      if (!isActive) {
        return;
      }

      if (useAuthStore.getState().status !== 'loading') {
        return;
      }

      if (session) {
        setSession(session);
        return;
      }

      clearSession();
    })();

    return () => {
      isActive = false;
    };
  }, [clearSession, setLoading, setSession]);

  useEffect(() => {
    if (status === 'authenticated' && isPublicEntryPath(pathname)) {
      router.replace('/feed');
      router.refresh();
      return;
    }

    if (status === 'unauthenticated' && isProtectedPath(pathname)) {
      router.replace('/login');
      router.refresh();
    }
  }, [pathname, router, status]);

  return children;
}
