import test from 'node:test';
import assert from 'node:assert/strict';

import { sanitizeLogLine, scanLogContent } from './check-sensitive-logs.mjs';

test('sanitiza URLs com credenciais preservando host e porta', () => {
  const sanitized = sanitizeLogLine(
    '{"redisUrl":"redis://default:super-secret@redis:6379","status":"connected"}',
  );

  assert.match(sanitized, /scheme=redis/u);
  assert.match(sanitized, /host=redis/u);
  assert.match(sanitized, /port=6379/u);
  assert.doesNotMatch(sanitized, /super-secret/u);
  assert.doesNotMatch(sanitized, /redis:\/\//u);
});

test('sanitiza tokens e assignments sensiveis', () => {
  const sanitized = sanitizeLogLine(
    '{"authorization":"Bearer abcdefghijklmnop","password":"super-secret","secret":"top-secret"}',
  );

  assert.match(sanitized, /"authorization":"Bearer \*\*\*"/u);
  assert.match(sanitized, /"password":"\*\*\*"/u);
  assert.match(sanitized, /"secret":"\*\*\*"/u);
  assert.doesNotMatch(sanitized, /abcdefghijklmnop|super-secret|top-secret/u);
});

test('identifica apenas padroes bloqueantes reais e ignora texto seguro', () => {
  const findings = scanLogContent(
    [
      '{"service":"frontend","event":"presence_token_start","message":"Token route started"}',
      '{"service":"presence","redisHost":"redis","redisPort":"6379","status":"connected"}',
      '{"service":"backend","authorization":"Bearer abcdefghijklmnop"}',
      '{"service":"backend","database":"postgres://user:secret@postgres:5432/app"}',
    ].join('\n'),
  );

  assert.equal(findings.length, 2);
  assert.equal(findings[0].ruleId, 'bearer_token');
  assert.equal(findings[1].ruleId, 'postgres_url');
});
