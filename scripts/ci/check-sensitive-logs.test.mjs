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

  assert.equal(findings.length, 3);
  assert.deepEqual(
    findings.map((finding) => finding.ruleId),
    ['bearer_token', 'postgres_url', 'url_with_credentials'],
  );
});

test('bloqueia query string sensivel de callbacks OAuth e OpenID', () => {
  const findings = scanLogContent(
    [
      'GET /api/auth/social/google/callback?code=oauth-code&state=oauth-state 307',
      'GET /api/auth/accounts/steam/link/callback?openid.sig=signature&openid.return_to=http%3A%2F%2Flocalhost%2Fcallback 400',
      'GET /ws/presence?token=presence-token-value 101',
    ].join('\n'),
  );

  assert.deepEqual(
    findings.map((finding) => finding.ruleId),
    ['oauth_code_query', 'oauth_state_query', 'openid_signature_query', 'openid_return_to_query', 'token_query'],
  );
  assert.doesNotMatch(findings[0].line, /oauth-code/u);
  assert.doesNotMatch(findings[1].line, /oauth-state/u);
  assert.doesNotMatch(findings[4].line, /presence-token-value/u);
});
