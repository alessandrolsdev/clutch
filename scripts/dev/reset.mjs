import { logStep, runCompose } from './helpers.mjs';

async function main() {
  logStep('Derrubando o stack e removendo volumes nomeados do compose');
  runCompose(['down', '-v', '--remove-orphans']);

  logStep('Reset concluído');
}

main().catch((error) => {
  process.stderr.write(`[clutch-dev] reset falhou: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
