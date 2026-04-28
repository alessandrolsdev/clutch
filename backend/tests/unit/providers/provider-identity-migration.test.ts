import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('provider identity migration', () => {
  it('backfills Epic legacy identities before creating the global unique index', () => {
    const migration = readFileSync(
      join(
        process.cwd(),
        'prisma/migrations/20260428170000_provider_identity_foundation/migration.sql',
      ),
      'utf8',
    );
    const epicBackfillIndex = migration.indexOf("'legacy:epic:' || \"userId\"");
    const duplicateGuardIndex = migration.indexOf('platform_integrations contains duplicate external identity');
    const uniqueIndexIndex = migration.indexOf('CREATE UNIQUE INDEX "platform_integrations_platform_externalId_key"');

    expect(epicBackfillIndex).toBeGreaterThan(-1);
    expect(duplicateGuardIndex).toBeGreaterThan(epicBackfillIndex);
    expect(uniqueIndexIndex).toBeGreaterThan(duplicateGuardIndex);
  });

  it('documents duplicate diagnostics by platform, externalId and affected users', () => {
    const diagnostics = readFileSync(
      join(process.cwd(), 'prisma/diagnostics/platform-integration-identity-duplicates.sql'),
      'utf8',
    );

    expect(diagnostics).toContain('"platform"');
    expect(diagnostics).toContain('"externalId"');
    expect(diagnostics).toContain('affected_user_count');
    expect(diagnostics).toContain('GROUP BY "platform", "externalId"');
    expect(diagnostics).toContain('HAVING COUNT(*) > 1');
  });
});
