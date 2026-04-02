import { describe, expect, it } from 'vitest';
import {
  resolveContainerDependencySyncCommands,
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
  it('usa npm ci como caminho primario e npm install como fallback para recuperar volumes quebrados', () => {
    expect(resolveContainerDependencySyncCommands()).toEqual([
      ['npm', 'ci'],
      ['npm', 'install'],
    ]);
  });

  it('nao reinstala dependencias nem regenera o Prisma quando o runtime ja esta sincronizado', () => {
    expect(resolveContainerRuntimePlan(buildState())).toEqual({
      installDependencies: false,
      generatePrismaClient: false,
    });
  });

  it('instala dependencias e regenera o Prisma quando node_modules ainda nao esta pronto', () => {
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

  it('reinstala dependencias quando o package-lock mudou depois do baseline salvo', () => {
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

  it('reinstala dependencias e regenera o Prisma quando os runtime stamps ainda nao existem', () => {
    expect(
      resolveContainerRuntimePlan(
        buildState({
          storedPackageLockHash: null,
          storedPrismaSchemaHash: null,
        }),
      ),
    ).toEqual({
      installDependencies: true,
      generatePrismaClient: true,
    });
  });

  it('forca a sincronizacao inicial quando apenas um dos runtime stamps esta ausente', () => {
    expect(
      resolveContainerRuntimePlan(
        buildState({
          storedPrismaSchemaHash: null,
        }),
      ),
    ).toEqual({
      installDependencies: true,
      generatePrismaClient: true,
    });
  });

  it('regenera o Prisma quando o schema muda sem alterar dependencias', () => {
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

  it('regenera o Prisma quando o client ainda nao existe no volume atual', () => {
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
