import type Redis from 'ioredis';
import type { FastifyRequest } from 'fastify';
import { sanitizeRequestPath } from './logging';

type AuthRateLimitRouteId = 'login' | 'register' | 'refresh';

function createExceededLogger(
  routeId: AuthRateLimitRouteId,
  max: number,
  timeWindow: string,
) {
  return (request: FastifyRequest): void => {
    request.log.warn({
      event: 'auth_rate_limit_exceeded',
      requestId: request.id,
      method: request.method,
      path: sanitizeRequestPath(request.url),
      status: 429,
      limiter: routeId,
      max,
      timeWindow,
    }, 'Auth rate limit exceeded');
  };
}

function buildPolicy(
  routeId: AuthRateLimitRouteId,
  max: number,
  timeWindow: string,
){
  return {
    routeId,
    groupId: `auth-${routeId}`,
    max,
    timeWindow,
    onExceeded: createExceededLogger(routeId, max, timeWindow),
  };
}

export const AUTH_RATE_LIMIT_POLICIES = {
  // 5 tentativas em 5 minutos cobre erro humano comum sem deixar brute force barato.
  login: buildPolicy('login', 5, '5 minutes'),
  // Cadastro legitimo é raro; 3 em 15 minutos reduz abuso automatizado sem bloquear onboarding normal.
  register: buildPolicy('register', 3, '15 minutes'),
  // Refresh precisa tolerar chamadas concorrentes do SSR sem virar vetor de flooding.
  refresh: buildPolicy('refresh', 20, '1 minute'),
} as const;

export function createAuthRateLimitPluginOptions(
  redisClient?: Redis | null,
){
  return {
    global: false,
    hook: 'onRequest' as const,
    nameSpace: 'clutch-auth-rate-limit-',
    keyGenerator: (request: FastifyRequest): string => request.ip,
    skipOnError: true,
    redis: redisClient ?? undefined,
    errorResponseBuilder: () => ({
      statusCode: 429,
      error: 'Too Many Requests',
      message: 'Muitas tentativas. Tente novamente em instantes.',
    }),
  };
}
