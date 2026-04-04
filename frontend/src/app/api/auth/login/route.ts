import { NextResponse } from 'next/server';
import {
  appendRefreshSetCookie,
  setAccessSessionCookie,
} from '@/lib/auth/backend-refresh';
import {
  logServerEvent,
  REQUEST_ID_HEADER,
  resolveServerRequestId,
  serializeServerError,
} from '@/lib/server/logger';
import { loginBackendResponseSchema, loginRequestSchema } from '@/schemas/auth';
import { buildApiUrl } from '@/services/http/client';

type ErrorBody = {
  message?: string;
};

async function readJsonBody(response: Response): Promise<unknown> {
  const text = await response.text();

  if (text.length === 0) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function resolveMessage(payload: unknown, fallback: string): string {
  if (typeof payload === 'object' && payload !== null && 'message' in payload) {
    const message = (payload as ErrorBody).message;

    if (typeof message === 'string' && message.length > 0) {
      return message;
    }
  }

  return fallback;
}

export async function POST(request: Request) {
  const requestId = resolveServerRequestId(request.headers.get(REQUEST_ID_HEADER));
  const startedAt = Date.now();
  const path = new URL(request.url).pathname;

  logServerEvent('info', 'frontend_auth_login_start', 'Frontend auth login started', {
    requestId,
    method: request.method,
    path,
  });

  let parsedBody: unknown;

  try {
    parsedBody = await request.json();
  } catch {
    logServerEvent('warn', 'frontend_auth_login_invalid_body', 'Frontend auth login received invalid body', {
      requestId,
      status: 400,
      duration_ms: Date.now() - startedAt,
    });

    return NextResponse.json(
      { message: 'Requisicao de login invalida.' },
      { status: 400 },
    );
  }

  const credentialsResult = loginRequestSchema.safeParse(parsedBody);

  if (!credentialsResult.success) {
    logServerEvent('warn', 'frontend_auth_login_validation_failed', 'Frontend auth login validation failed', {
      requestId,
      status: 400,
      duration_ms: Date.now() - startedAt,
    });

    return NextResponse.json(
      { message: 'Email e senha sao obrigatorios.' },
      { status: 400 },
    );
  }

  let backendResponse: Response;

  try {
    backendResponse = await fetch(buildApiUrl('/auth/login'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        [REQUEST_ID_HEADER]: requestId,
      },
      body: JSON.stringify(credentialsResult.data),
    });
  } catch (error) {
    logServerEvent('error', 'frontend_auth_login_backend_unreachable', 'Frontend auth login could not reach backend', {
      requestId,
      status: 502,
      duration_ms: Date.now() - startedAt,
      ...serializeServerError(error),
    });

    return NextResponse.json(
      { message: 'Nao foi possivel contatar o backend de autenticacao.' },
      { status: 502 },
    );
  }

  const payload = await readJsonBody(backendResponse);

  if (!backendResponse.ok) {
    logServerEvent('warn', 'frontend_auth_login_rejected', 'Frontend auth login was rejected by backend', {
      requestId,
      backendStatus: backendResponse.status,
      status: backendResponse.status,
      duration_ms: Date.now() - startedAt,
    });

    return NextResponse.json(
      {
        message: resolveMessage(
          payload,
          backendResponse.status === 401
            ? 'Credenciais invalidas.'
            : 'Falha ao autenticar.',
        ),
      },
      { status: backendResponse.status },
    );
  }

  const sessionResult = loginBackendResponseSchema.safeParse(payload);

  if (!sessionResult.success) {
    logServerEvent('error', 'frontend_auth_login_invalid_backend_payload', 'Frontend auth login received invalid backend payload', {
      requestId,
      status: 502,
      duration_ms: Date.now() - startedAt,
    });

    return NextResponse.json(
      { message: 'Resposta invalida do backend de autenticacao.' },
      { status: 502 },
    );
  }

  const response = NextResponse.json(
    {
      id: sessionResult.data.id,
      username: sessionResult.data.username,
      message: sessionResult.data.message,
    },
    { status: 200 },
  );

  setAccessSessionCookie(response, sessionResult.data.token);
  appendRefreshSetCookie(response, backendResponse.headers.get('set-cookie'));

  logServerEvent('info', 'frontend_auth_login_success', 'Frontend auth login completed', {
    requestId,
    status: 200,
    duration_ms: Date.now() - startedAt,
    username: sessionResult.data.username,
  });

  return response;
}
