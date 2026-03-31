import { NextResponse } from 'next/server';
import { loginBackendResponseSchema, loginRequestSchema } from '@/schemas/auth';
import { AUTH_SESSION_COOKIE_NAME, getAuthSessionCookieOptions } from '@/lib/auth/session';
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
      { message: 'Requisição de login inválida.' },
      { status: 400 },
    );
  }

  const credentialsResult = loginRequestSchema.safeParse(parsedBody);

  if (!credentialsResult.success) {
    return NextResponse.json(
      { message: 'Email e senha são obrigatórios.' },
      { status: 400 },
    );
  }

  let backendResponse: Response;

  try {
    backendResponse = await fetch(buildApiUrl('/auth/login'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(credentialsResult.data),
    });
  } catch {
    return NextResponse.json(
      { message: 'Não foi possível contatar o backend de autenticação.' },
      { status: 502 },
    );
  }

  const payload = await readJsonBody(backendResponse);

  if (!backendResponse.ok) {
    return NextResponse.json(
      {
        message: resolveMessage(
          payload,
          backendResponse.status === 401
            ? 'Credenciais inválidas.'
            : 'Falha ao autenticar.',
        ),
      },
      { status: backendResponse.status },
    );
  }

  const sessionResult = loginBackendResponseSchema.safeParse(payload);

  if (!sessionResult.success) {
    return NextResponse.json(
      { message: 'Resposta inválida do backend de autenticação.' },
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

  response.cookies.set(
    AUTH_SESSION_COOKIE_NAME,
    sessionResult.data.token,
    getAuthSessionCookieOptions(),
  );

  return response;
}
