import { logStep, runCompose } from './helpers.mjs';

async function main() {
  logStep('Subindo o stack container-first com build');
  runCompose(['up', '-d', '--build']);

  logStep('Aplicando bootstrap do backend');
  runCompose(['exec', '-T', 'backend', 'sh', './scripts/container-bootstrap.sh']);

  logStep('Bootstrap concluído');
}

main().catch((error) => {
  process.stderr.write(`[clutch-dev] bootstrap falhou: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
