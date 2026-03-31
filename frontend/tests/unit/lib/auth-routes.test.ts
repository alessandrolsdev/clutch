import { describe, expect, it } from 'vitest';
import { isProtectedPath, isPublicEntryPath } from '@/lib/auth/routes';

describe('auth route helpers', () => {
  it('identifies protected app routes', () => {
    expect(isProtectedPath('/feed')).toBe(true);
    expect(isProtectedPath('/feed/new')).toBe(true);
    expect(isProtectedPath('/settings')).toBe(true);
    expect(isProtectedPath('/login')).toBe(false);
  });

  it('identifies public entry routes', () => {
    expect(isPublicEntryPath('/')).toBe(true);
    expect(isPublicEntryPath('/login')).toBe(true);
    expect(isPublicEntryPath('/register')).toBe(true);
    expect(isPublicEntryPath('/feed')).toBe(false);
  });
});
