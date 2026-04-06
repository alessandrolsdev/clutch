import {
  assertServicesRunning,
  buildCookieHeader,
  logStep,
  parseSetCookie,
  waitForHealthyHttp,
} from './helpers.mjs';

async function validateLoginFlow() {
  const loginResponse = await fetch('http://localhost/api/auth/login', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      email: 'clutchplayer@clutch.gg',
      password: 'clutch123',
    }),
  });

  if (!loginResponse.ok) {
    throw new Error(`Login falhou com status ${loginResponse.status}`);
  }

  const cookies = parseSetCookie(
    typeof loginResponse.headers.getSetCookie === 'function'
      ? loginResponse.headers.getSetCookie()
      : loginResponse.headers.get('set-cookie'),
  );

  if (cookies.length === 0) {
    throw new Error('Login não retornou cookies de sessão.');
  }

  const cookieHeader = buildCookieHeader(cookies);

  const meResponse = await fetch('http://localhost/api/auth/me', {
    headers: {
      cookie: cookieHeader,
    },
  });

  if (!meResponse.ok) {
    throw new Error(`/api/auth/me falhou com status ${meResponse.status}`);
  }

  const presenceResponse = await fetch('http://localhost/api/auth/presence-token', {
    headers: {
      cookie: cookieHeader,
    },
  });

  if (!presenceResponse.ok) {
    throw new Error(`/api/auth/presence-token falhou com status ${presenceResponse.status}`);
  }

  const logoutResponse = await fetch('http://localhost/api/auth/logout', {
    method: 'POST',
    headers: {
      cookie: cookieHeader,
    },
  });

  if (!logoutResponse.ok) {
    throw new Error(`/api/auth/logout falhou com status ${logoutResponse.status}`);
  }
}

async function main() {
  logStep('Verificando serviços principais em execução');
  assertServicesRunning();

  logStep('Validando health do backend via proxy');
  await waitForHealthyHttp('http://localhost/api/health');

  logStep('Validando health do presence via proxy');
  await waitForHealthyHttp('http://localhost/presence/health');

  logStep('Validando fluxo mínimo de autenticação via proxy');
  await validateLoginFlow();

  logStep('Validação concluída');
}

main().catch((error) => {
  process.stderr.write(`[clutch-dev] validação falhou: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
