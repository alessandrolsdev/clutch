export type ContainerRuntimeState = {
  nodeModulesReady: boolean;
  prismaClientReady: boolean;
  packageLockHash: string;
  storedPackageLockHash: string | null;
  prismaSchemaHash: string;
  storedPrismaSchemaHash: string | null;
};

export type ContainerRuntimePlan = {
  installDependencies: boolean;
  generatePrismaClient: boolean;
};

export function resolveContainerRuntimePlan(
  state: ContainerRuntimeState,
): ContainerRuntimePlan {
  const installDependencies =
    !state.nodeModulesReady ||
    (state.storedPackageLockHash !== null &&
      state.storedPackageLockHash !== state.packageLockHash);

  const generatePrismaClient =
    installDependencies ||
    !state.prismaClientReady ||
    (state.storedPrismaSchemaHash !== null &&
      state.storedPrismaSchemaHash !== state.prismaSchemaHash);

  return {
    installDependencies,
    generatePrismaClient,
  };
}
