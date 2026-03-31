const PROTECTED_PREFIXES = ['/feed', '/notifications', '/settings'];
const PUBLIC_ENTRY_PATHS = ['/', '/login', '/register'];
const PROFILE_PATH_REGEX = /^\/[a-zA-Z0-9_]{3,30}$/;

export function isProtectedPath(pathname: string): boolean {
  if (
    PROFILE_PATH_REGEX.test(pathname) &&
    !PUBLIC_ENTRY_PATHS.includes(pathname)
  ) {
    return true;
  }

  return PROTECTED_PREFIXES.some((prefix) => {
    return pathname === prefix || pathname.startsWith(`${prefix}/`);
  });
}

export function isPublicEntryPath(pathname: string): boolean {
  return PUBLIC_ENTRY_PATHS.includes(pathname);
}
