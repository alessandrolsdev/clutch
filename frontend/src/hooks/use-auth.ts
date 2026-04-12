'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { logoutAuthSession } from '@/services/session';
import { useAuthStore } from '@/store/auth-store';

export function useAuth() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const status = useAuthStore((state) => state.status);

  const logout = async () => {
    try {
      await logoutAuthSession();
    } finally {
      queryClient.clear();
      router.replace('/login');
      router.refresh();
    }
  };

  return {
    user,
    status,
    logout,
  };
}
