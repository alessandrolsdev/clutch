export function isValidRemoteUrl(value: string | null | undefined): value is string {
  if (!value) {
    return false;
  }

  try {
    const parsedUrl = new URL(value);
    return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:';
  } catch {
    return false;
  }
}

export function normalizeRemoteUrl(value: string | null | undefined): string {
  return typeof value === 'string' ? value.trim() : '';
}
