import { apiRequest } from '@/lib/api';
import { authSessionSchema, type AuthSession } from '@/schemas/auth';
import { useAuthStore } from '@/store/auth-store';

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();

  if (text.length === 0) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

export async function fetchAuthSession(): Promise<AuthSession | null> {
  const response = await apiRequest('/auth/me', {
    method: 'GET',
    clearSessionOnUnauthorized: false,
  });

  if (!response.ok) {
    return null;
  }

  const payload = await readJson(response);
  const parsed = authSessionSchema.safeParse(payload);

  return parsed.success ? parsed.data : null;
}

export async function logoutAuthSession(): Promise<void> {
  try {
    await apiRequest('/auth/logout', {
      method: 'POST',
    });
  } finally {
    useAuthStore.getState().clearSession();
  }
}
