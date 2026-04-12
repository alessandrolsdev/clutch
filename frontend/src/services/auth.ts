import {
  loginRequestSchema,
  loginSessionSchema,
  type LoginRequestValues,
  type LoginSession,
  registerRequestSchema,
  registerSessionSchema,
  type RegisterRequestValues,
  type RegisterSession,
} from '@/schemas/auth';
import { apiRequest } from '@/lib/api';

type ErrorResponse = {
  message?: string;
};

export class AuthRequestError extends Error {
  public readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'AuthRequestError';
    this.status = status;
  }
}

async function readJson(response: Response): Promise<unknown> {
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

function resolveErrorMessage(payload: unknown, fallback: string): string {
  if (typeof payload === 'object' && payload !== null && 'message' in payload) {
    const message = (payload as ErrorResponse).message;

    if (typeof message === 'string' && message.length > 0) {
      return message;
    }
  }

  return fallback;
}

export async function login(input: LoginRequestValues): Promise<LoginSession> {
  const credentials = loginRequestSchema.parse(input);

  const response = await apiRequest('/auth/login', {
    method: 'POST',
    body: credentials,
    clearSessionOnUnauthorized: false,
    retryOnUnauthorized: false,
  });

  const payload = await readJson(response);

  if (!response.ok) {
    const fallbackMessage =
      response.status === 401
        ? 'Credenciais inválidas.'
        : 'Não foi possível autenticar agora.';

    throw new AuthRequestError(
      response.status,
      resolveErrorMessage(payload, fallbackMessage),
    );
  }

  return loginSessionSchema.parse(payload);
}

export async function register(
  input: RegisterRequestValues,
): Promise<RegisterSession> {
  const registration = registerRequestSchema.parse(input);

  const response = await apiRequest('/auth/register', {
    method: 'POST',
    body: registration,
    clearSessionOnUnauthorized: false,
    retryOnUnauthorized: false,
  });

  const payload = await readJson(response);

  if (!response.ok) {
    const fallbackMessage =
      response.status === 409
        ? 'Email ou username ja esta em uso.'
        : 'Nao foi possivel criar a conta agora.';

    throw new AuthRequestError(
      response.status,
      resolveErrorMessage(payload, fallbackMessage),
    );
  }

  return registerSessionSchema.parse(payload);
}
