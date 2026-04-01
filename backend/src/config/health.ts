export type DependencyHealthStatus = 'ok' | 'error';

export type ReadinessReport = {
  status: 'ok' | 'error';
  checks: {
    database: DependencyHealthStatus;
    redis: DependencyHealthStatus;
  };
};

type ReadinessCheckDependencies = {
  checkDatabase?: () => Promise<unknown>;
  checkRedis?: () => Promise<unknown>;
};

async function defaultDatabaseCheck(): Promise<void> {
  const { prisma } = await import('../infra/database/client');
  await prisma.$queryRaw`SELECT 1`;
}

async function defaultRedisCheck(): Promise<void> {
  const { redis } = await import('../infra/cache/redis');
  await redis.ping();
}

export async function runReadinessChecks(
  dependencies: ReadinessCheckDependencies = {},
): Promise<ReadinessReport> {
  const checkDatabase = dependencies.checkDatabase ?? defaultDatabaseCheck;
  const checkRedis = dependencies.checkRedis ?? defaultRedisCheck;

  const checks: ReadinessReport['checks'] = {
    database: 'ok',
    redis: 'ok',
  };

  try {
    await checkDatabase();
  } catch {
    checks.database = 'error';
  }

  try {
    await checkRedis();
  } catch {
    checks.redis = 'error';
  }

  return {
    status:
      checks.database === 'ok' && checks.redis === 'ok'
        ? 'ok'
        : 'error',
    checks,
  };
}
