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
import {
  registerBackendResponseSchema,
  registerRequestSchema,
} from '@/schemas/auth';
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

  logServerEvent('info', 'frontend_auth_register_start', 'Frontend auth register started', {
    requestId,
    method: request.method,
    path,
  });

  let parsedBody: unknown;

  try {
    parsedBody = await request.json();
  } catch {
    logServerEvent('warn', 'frontend_auth_register_invalid_body', 'Frontend auth register received invalid body', {
      requestId,
      status: 400,
      duration_ms: Date.now() - startedAt,
    });

    return NextResponse.json(
      { message: 'Requisicao de cadastro invalida.' },
      { status: 400 },
    );
  }

  const registerResult = registerRequestSchema.safeParse(parsedBody);

  if (!registerResult.success) {
    logServerEvent('warn', 'frontend_auth_register_validation_failed', 'Frontend auth register validation failed', {
      requestId,
      status: 400,
      duration_ms: Date.now() - startedAt,
    });

    return NextResponse.json(
      { message: 'Username, email e senha sao obrigatorios.' },
      { status: 400 },
    );
  }

  let backendResponse: Response;

  try {
    backendResponse = await fetch(buildApiUrl('/auth/register'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        [REQUEST_ID_HEADER]: requestId,
      },
      body: JSON.stringify(registerResult.data),
    });
  } catch (error) {
    logServerEvent('error', 'frontend_auth_register_backend_unreachable', 'Frontend auth register could not reach backend', {
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
    logServerEvent('warn', 'frontend_auth_register_rejected', 'Frontend auth register was rejected by backend', {
      requestId,
      backendStatus: backendResponse.status,
      status: backendResponse.status,
      duration_ms: Date.now() - startedAt,
    });

    return NextResponse.json(
      {
        message: resolveMessage(
          payload,
          backendResponse.status === 409
            ? 'Email ou username ja esta em uso.'
            : 'Falha ao registrar.',
        ),
      },
      { status: backendResponse.status },
    );
  }

  const sessionResult = registerBackendResponseSchema.safeParse(payload);

  if (!sessionResult.success) {
    logServerEvent('error', 'frontend_auth_register_invalid_backend_payload', 'Frontend auth register received invalid backend payload', {
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
      message: 'Conta criada com sucesso.',
    },
    { status: 201 },
  );

  setAccessSessionCookie(response, sessionResult.data.token);
  appendRefreshSetCookie(response, backendResponse.headers.get('set-cookie'));

  logServerEvent('info', 'frontend_auth_register_success', 'Frontend auth register completed', {
    requestId,
    status: 201,
    duration_ms: Date.now() - startedAt,
    username: sessionResult.data.username,
  });

  return response;
}
