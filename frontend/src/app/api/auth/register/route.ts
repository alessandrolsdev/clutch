import { NextResponse } from 'next/server';
import {
  registerBackendResponseSchema,
  registerRequestSchema,
} from '@/schemas/auth';
import {
  AUTH_SESSION_COOKIE_NAME,
  getAuthSessionCookieOptions,
} from '@/lib/auth/session';
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
  let parsedBody: unknown;

  try {
    parsedBody = await request.json();
  } catch {
    return NextResponse.json(
      { message: 'Requisicao de cadastro invalida.' },
      { status: 400 },
    );
  }

  const registerResult = registerRequestSchema.safeParse(parsedBody);

  if (!registerResult.success) {
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
      },
      body: JSON.stringify(registerResult.data),
    });
  } catch {
    return NextResponse.json(
      { message: 'Nao foi possivel contatar o backend de autenticacao.' },
      { status: 502 },
    );
  }

  const payload = await readJsonBody(backendResponse);

  if (!backendResponse.ok) {
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

  response.cookies.set(
    AUTH_SESSION_COOKIE_NAME,
    sessionResult.data.token,
    getAuthSessionCookieOptions(),
  );

  return response;
}
