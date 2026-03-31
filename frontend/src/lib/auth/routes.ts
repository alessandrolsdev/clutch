const PROTECTED_PREFIXES = ['/feed', '/notifications', '/settings'];
const PUBLIC_ENTRY_PATHS = ['/', '/login', '/register'];

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((prefix) => {
    return pathname === prefix || pathname.startsWith(`${prefix}/`);
  });
}

export function isPublicEntryPath(pathname: string): boolean {
  return PUBLIC_ENTRY_PATHS.includes(pathname);
}
