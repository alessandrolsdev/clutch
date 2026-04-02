import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  resolveContainerDependencySyncCommand,
  resolveContainerRuntimePlan,
} from '../src/config/container-runtime';

const cwd = process.cwd();
const nodeModulesPath = join(cwd, 'node_modules');
const runtimeStatePath = join(nodeModulesPath, '.clutch-runtime');
const packageLockPath = join(cwd, 'package-lock.json');
const prismaSchemaPath = join(cwd, 'prisma', 'schema.prisma');
const prismaClientPath = join(nodeModulesPath, '.prisma', 'client', 'index.js');
const tsxBinaryPath = join(nodeModulesPath, '.bin', 'tsx');
const packageLockStampPath = join(runtimeStatePath, 'package-lock.sha256');
const prismaSchemaStampPath = join(runtimeStatePath, 'prisma-schema.sha256');

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function readOptionalTextFile(path: string): Promise<string | null> {
  if (!(await pathExists(path))) {
    return null;
  }

  return (await readFile(path, 'utf8')).trim();
}

async function hashFile(path: string): Promise<string> {
  const content = await readFile(path);
  return createHash('sha256').update(content).digest('hex');
}

async function runCommand(command: string, args: string[]): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: 'inherit',
      env: process.env,
    });

    child.on('error', reject);
    child.on('exit', (code, signal) => {
      if (signal) {
        reject(new Error(`${command} finalizou com sinal ${signal}`));
        return;
      }

      if (code !== 0) {
        reject(new Error(`${command} ${args.join(' ')} falhou com código ${code ?? 'desconhecido'}`));
        return;
      }

      resolve();
    });
  });
}

async function writeRuntimeStamps(packageLockHash: string, prismaSchemaHash: string): Promise<void> {
  await mkdir(runtimeStatePath, { recursive: true });
  await writeFile(packageLockStampPath, `${packageLockHash}\n`, 'utf8');
  await writeFile(prismaSchemaStampPath, `${prismaSchemaHash}\n`, 'utf8');
}

async function main(): Promise<void> {
  const [packageLockHash, prismaSchemaHash] = await Promise.all([
    hashFile(packageLockPath),
    hashFile(prismaSchemaPath),
  ]);

  const state = {
    nodeModulesReady: await pathExists(tsxBinaryPath),
    prismaClientReady: await pathExists(prismaClientPath),
    packageLockHash,
    storedPackageLockHash: await readOptionalTextFile(packageLockStampPath),
    prismaSchemaHash,
    storedPrismaSchemaHash: await readOptionalTextFile(prismaSchemaStampPath),
  };

  const plan = resolveContainerRuntimePlan(state);

  if (plan.installDependencies) {
    console.log('[container-dev-start] Sincronizando dependências do backend...');
    const [command, ...args] = resolveContainerDependencySyncCommand();
    await runCommand(command, args);
  }

  if (plan.generatePrismaClient) {
    console.log('[container-dev-start] Regenerando Prisma Client...');
    await runCommand('npx', ['prisma', 'generate']);
  }

  await writeRuntimeStamps(packageLockHash, prismaSchemaHash);

  console.log('[container-dev-start] Aplicando migrations pendentes...');
  await runCommand('npm', ['run', 'db:migrate:prod']);

  console.log('[container-dev-start] Iniciando servidor Fastify...');
  await runCommand('npm', ['run', 'dev']);
}

main().catch((error: unknown) => {
  console.error('[container-dev-start] Falha ao iniciar o backend:', error);
  process.exit(1);
});
