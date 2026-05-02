import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const tokenFile = process.env.PRESENCE_TOKEN_FILE;
const wsUrl = process.env.PRESENCE_WS_URL;
const wsOrigin = process.env.PRESENCE_WS_ORIGIN ?? 'http://localhost';
const timeoutMs = Number(process.env.PRESENCE_WS_TIMEOUT_MS ?? '15000');

function fail(message) {
  throw new Error(message);
}

async function readPresenceToken() {
  if (!tokenFile) {
    fail('PRESENCE_TOKEN_FILE nao foi definido.');
  }

  const raw = await readFile(tokenFile, 'utf8');
  let parsed;

  try {
    parsed = JSON.parse(raw);
  } catch {
    fail('Nao foi possivel interpretar a resposta de /api/auth/presence-token.');
  }

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('token' in parsed) ||
    typeof parsed.token !== 'string' ||
    parsed.token.length === 0
  ) {
    fail('A resposta de /api/auth/presence-token nao contem um token valido.');
  }

  return parsed.token;
}

export function maskPresenceSocketUrl(rawUrl) {
  try {
    const parsedUrl = new URL(rawUrl);

    if (parsedUrl.searchParams.has('token')) {
      parsedUrl.searchParams.set('token', '[REDACTED]');
    }

    return parsedUrl.toString().replace(/token=%5BREDACTED%5D/iu, 'token=[REDACTED]');
  } catch {
    return '[presence websocket url redacted]';
  }
}

async function validatePresenceHandshake() {
  if (!wsUrl || wsUrl.trim().length === 0) {
    fail('PRESENCE_WS_URL nao foi definido.');
  }

  if (typeof WebSocket !== 'function') {
    fail('O runtime Node atual nao expoe WebSocket global para o smoke test.');
  }

  const token = await readPresenceToken();
  const socketUrl = new URL('/ws/presence', wsUrl);
  socketUrl.searchParams.set('token', token);

  console.log(`[presence-smoke] connecting to ${maskPresenceSocketUrl(socketUrl.toString())}`);

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Timeout aguardando handshake websocket em ${timeoutMs}ms.`));
    }, timeoutMs);

    let settled = false;

    const settle = (callback) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeout);
      callback();
    };

    const socket = new WebSocket(socketUrl, {
      headers: {
        Origin: wsOrigin,
      },
    });

    socket.addEventListener('open', () => {
      console.log('[presence-smoke] websocket connected');
      socket.send(
        JSON.stringify({
          event: 'PING',
          payload: null,
          ts: Date.now(),
        }),
      );
    });

    socket.addEventListener('message', (event) => {
      console.log(`[presence-smoke] message: ${event.data}`);

      let parsed;

      try {
        parsed = JSON.parse(event.data);
      } catch {
        settle(() => reject(new Error('Mensagem websocket invalida durante o smoke test.')));
        return;
      }

      if (parsed?.event === 'PONG') {
        settle(() => {
          socket.close();
          resolve(undefined);
        });
      }
    });

    socket.addEventListener('error', (event) => {
      settle(() => reject(new Error(`Falha no websocket de presence: ${event.type}`)));
    });

    socket.addEventListener('close', (event) => {
      if (!settled) {
        settle(() =>
          reject(
            new Error(
              `Conexao websocket encerrada antes do PONG. code=${event.code} reason=${event.reason || 'n/a'}`,
            ),
          ),
        );
      } else {
        console.log(
          `[presence-smoke] websocket closed after success. code=${event.code} reason=${event.reason || 'n/a'}`,
        );
      }
    });
  });
}

const isDirectExecution =
  typeof process.argv[1] === 'string' && fileURLToPath(import.meta.url) === process.argv[1];

if (isDirectExecution) {
  validatePresenceHandshake().catch((error) => {
    console.error('[presence-smoke] validation failed:', error);
    process.exit(1);
  });
}
