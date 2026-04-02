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

export type ContainerRuntimeCommand = readonly [
  command: string,
  ...args: string[],
];

export function resolveContainerDependencySyncCommands(): readonly [
  ContainerRuntimeCommand,
  ContainerRuntimeCommand,
] {
  return [
    ['npm', 'ci'],
    ['npm', 'install'],
  ];
}

export function resolveContainerRuntimePlan(
  state: ContainerRuntimeState,
): ContainerRuntimePlan {
  const missingRuntimeStamps =
    state.storedPackageLockHash === null ||
    state.storedPrismaSchemaHash === null;

  const installDependencies =
    !state.nodeModulesReady ||
    missingRuntimeStamps ||
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
