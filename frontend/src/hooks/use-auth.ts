'use client';

import { useRouter } from 'next/navigation';
import { logoutAuthSession } from '@/services/session';
import { useAuthStore } from '@/store/auth-store';

export function useAuth() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const status = useAuthStore((state) => state.status);

  const logout = async () => {
    await logoutAuthSession();
    router.replace('/login');
    router.refresh();
  };

  return {
    user,
    status,
    logout,
  };
}
