import { apiRequest } from '@/lib/api';
import {
  markAllNotificationsReadResponseSchema,
  notificationRecordSchema,
  notificationsResponseSchema,
  type NotificationRecord,
  type NotificationsResponse,
} from '@/schemas/notifications';

type ErrorResponse = {
  message?: string;
};

type FetchNotificationsInput = {
  userId: string;
  unreadOnly?: boolean;
};

export class NotificationsRequestError extends Error {
  public readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'NotificationsRequestError';
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

export async function fetchNotifications(
  input: FetchNotificationsInput,
): Promise<NotificationsResponse> {
  const searchParams = new URLSearchParams();

  if (input.unreadOnly) {
    searchParams.set('unreadOnly', 'true');
  }

  const path = `/notifications/${encodeURIComponent(input.userId)}${
    searchParams.size > 0 ? `?${searchParams.toString()}` : ''
  }`;

  const response = await apiRequest(path, { method: 'GET' });
  const payload = await readJson(response);

  if (!response.ok) {
    throw new NotificationsRequestError(
      response.status,
      resolveErrorMessage(payload, 'Nao foi possivel carregar as notificacoes agora.'),
    );
  }

  return notificationsResponseSchema.parse(payload);
}

export async function markNotificationAsRead(
  notificationId: string,
): Promise<NotificationRecord> {
  const response = await apiRequest(
    `/notifications/${encodeURIComponent(notificationId)}/read`,
    {
      method: 'PATCH',
    },
  );
  const payload = await readJson(response);

  if (!response.ok) {
    throw new NotificationsRequestError(
      response.status,
      resolveErrorMessage(payload, 'Nao foi possivel marcar a notificacao como lida.'),
    );
  }

  return notificationRecordSchema.parse(payload);
}

export async function markAllNotificationsAsRead(): Promise<void> {
  const response = await apiRequest('/notifications/read-all', {
    method: 'PATCH',
  });
  const payload = await readJson(response);

  if (!response.ok) {
    throw new NotificationsRequestError(
      response.status,
      resolveErrorMessage(payload, 'Nao foi possivel marcar todas as notificacoes como lidas.'),
    );
  }

  markAllNotificationsReadResponseSchema.parse(payload);
}
