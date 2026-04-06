import { spawnSync } from 'node:child_process';

const composeBaseArgs = ['compose'];
const defaultServices = ['frontend', 'backend', 'presence', 'postgres', 'redis', 'traefik'];

function formatCommand(command, args) {
  return [command, ...args].join(' ');
}

export function runCommand(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: false,
    ...options,
  });

  if (result.error) {
    throw result.error;
  }

  if (typeof result.status === 'number' && result.status !== 0) {
    throw new Error(`Command failed: ${formatCommand(command, args)} (exit ${result.status})`);
  }
}

export function captureCommand(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    shell: false,
    ...options,
  });

  if (result.error) {
    throw result.error;
  }

  if (typeof result.status === 'number' && result.status !== 0) {
    const stderr = typeof result.stderr === 'string' ? result.stderr.trim() : '';
    const message = stderr.length > 0
      ? stderr
      : `Command failed: ${formatCommand(command, args)} (exit ${result.status})`;
    throw new Error(message);
  }

  return typeof result.stdout === 'string' ? result.stdout : '';
}

export function runCompose(args, options = {}) {
  runCommand('docker', [...composeBaseArgs, ...args], options);
}

export function captureCompose(args, options = {}) {
  return captureCommand('docker', [...composeBaseArgs, ...args], options);
}

export function logStep(message) {
  process.stdout.write(`[clutch-dev] ${message}\n`);
}

export function assertServicesRunning(expectedServices = defaultServices) {
  const output = captureCompose(['ps', '--services', '--status', 'running']);
  const runningServices = new Set(
    output
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter(Boolean),
  );

  const missingServices = expectedServices.filter((service) => !runningServices.has(service));

  if (missingServices.length > 0) {
    throw new Error(`Serviços não estão em execução: ${missingServices.join(', ')}`);
  }
}

export async function waitForHealthyHttp(url, options = {}) {
  const timeoutMs = options.timeoutMs ?? 60_000;
  const intervalMs = options.intervalMs ?? 2_000;
  const deadline = Date.now() + timeoutMs;
  let lastError = new Error(`Timeout aguardando ${url}`);

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { method: 'GET', cache: 'no-store' });

      if (response.ok) {
        return response;
      }

      lastError = new Error(`Healthcheck falhou em ${url} com status ${response.status}`);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw lastError;
}

export function parseSetCookie(setCookieHeaders) {
  const headers = Array.isArray(setCookieHeaders)
    ? setCookieHeaders
    : setCookieHeaders
      ? [setCookieHeaders]
      : [];

  return headers
    .map((header) => header.split(';', 1)[0]?.trim())
    .filter((value) => typeof value === 'string' && value.length > 0);
}

export function buildCookieHeader(cookies) {
  return cookies.join('; ');
}
