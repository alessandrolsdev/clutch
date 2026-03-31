const DEFAULT_PORT = 3344;

export function resolveServerPort(rawPort: string | undefined): number {
  if (!rawPort) {
    return DEFAULT_PORT;
  }

  const parsedPort = Number.parseInt(rawPort, 10);

  if (!Number.isInteger(parsedPort) || parsedPort <= 0 || parsedPort > 65535) {
    return DEFAULT_PORT;
  }

  return parsedPort;
}

export { DEFAULT_PORT };
