import { beforeAll, afterAll } from 'vitest';

// ─────────────────────────────────────────────────────────────
// Setup global dos testes
// Executado uma vez antes de todos os test files
// ─────────────────────────────────────────────────────────────

beforeAll(async () => {
  // Garante que estamos no ambiente de teste
  process.env.NODE_ENV = 'test';
});

afterAll(async () => {
  // Cleanup global após todos os testes
});
