import { describe, expect, it } from 'vitest';
import {
  resolveContainerRuntimePlan,
  type ContainerRuntimeState,
} from '../../../src/config/container-runtime';

function buildState(
  overrides: Partial<ContainerRuntimeState> = {},
): ContainerRuntimeState {
  return {
    nodeModulesReady: true,
    prismaClientReady: true,
    packageLockHash: 'lock-current',
    storedPackageLockHash: 'lock-current',
    prismaSchemaHash: 'schema-current',
    storedPrismaSchemaHash: 'schema-current',
    ...overrides,
  };
}

describe('container-runtime', () => {
  it('não reinstala dependências nem regenera o Prisma quando o runtime já está sincronizado', () => {
    expect(resolveContainerRuntimePlan(buildState())).toEqual({
      installDependencies: false,
      generatePrismaClient: false,
    });
  });

  it('instala dependências e regenera o Prisma quando node_modules ainda não está pronto', () => {
    expect(
      resolveContainerRuntimePlan(
        buildState({
          nodeModulesReady: false,
        }),
      ),
    ).toEqual({
      installDependencies: true,
      generatePrismaClient: true,
    });
  });

  it('reinstala dependências quando o package-lock mudou depois do baseline salvo', () => {
    expect(
      resolveContainerRuntimePlan(
        buildState({
          packageLockHash: 'lock-next',
        }),
      ),
    ).toEqual({
      installDependencies: true,
      generatePrismaClient: true,
    });
  });

  it('adota o baseline atual sem reinstalar quando ainda não existe hash persistido', () => {
    expect(
      resolveContainerRuntimePlan(
        buildState({
          storedPackageLockHash: null,
          storedPrismaSchemaHash: null,
        }),
      ),
    ).toEqual({
      installDependencies: false,
      generatePrismaClient: false,
    });
  });

  it('regenera o Prisma quando o schema muda sem alterar dependências', () => {
    expect(
      resolveContainerRuntimePlan(
        buildState({
          prismaSchemaHash: 'schema-next',
        }),
      ),
    ).toEqual({
      installDependencies: false,
      generatePrismaClient: true,
    });
  });

  it('regenera o Prisma quando o client ainda não existe no volume atual', () => {
    expect(
      resolveContainerRuntimePlan(
        buildState({
          prismaClientReady: false,
        }),
      ),
    ).toEqual({
      installDependencies: false,
      generatePrismaClient: true,
    });
  });
});
