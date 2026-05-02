import test from 'node:test';
import assert from 'node:assert/strict';

import { maskPresenceSocketUrl } from './validate-presence-handshake.mjs';

test('mascara token de presence antes de imprimir URL do websocket', () => {
  const masked = maskPresenceSocketUrl(
    'ws://localhost/ws/presence?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9&debug=true',
  );

  assert.equal(masked, 'ws://localhost/ws/presence?token=[REDACTED]&debug=true');
  assert.doesNotMatch(masked, /eyJhbGci/u);
});
