'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { type PendingFriendRequest } from '@/schemas/friends';
import {
  acceptFriendRequest,
  FriendsRequestError,
} from '@/services/friends';

type FriendRequestCardProps = {
  request: PendingFriendRequest;
  receiverUserId: string;
};

function formatCreatedAt(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

export function FriendRequestCard({
  request,
  receiverUserId,
}: FriendRequestCardProps) {
  const queryClient = useQueryClient();
  const senderName =
    request.sender.profile?.displayName && request.sender.profile.displayName.length > 0
      ? request.sender.profile.displayName
      : request.sender.username;
  const avatarFallback = request.sender.username.slice(0, 2).toUpperCase();

  const acceptMutation = useMutation({
    mutationFn: acceptFriendRequest,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['friend-requests', receiverUserId],
        }),
        queryClient.invalidateQueries({
          queryKey: ['friends', receiverUserId],
        }),
        queryClient.invalidateQueries({
          queryKey: ['profile'],
        }),
      ]);
    },
  });

  const serverError = acceptMutation.error instanceof FriendsRequestError
    ? acceptMutation.error.message
    : acceptMutation.isError
      ? 'Nao foi possivel aceitar o pedido agora.'
      : null;

  return (
    <Card data-testid="friend-request-card">
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <Avatar
            src={request.sender.profile?.avatarUrl}
            alt={request.sender.username}
            fallback={avatarFallback}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-primary">{senderName}</p>
            <p className="truncate text-xs text-secondary">@{request.sender.username}</p>
            <p className="mt-2 text-xs text-secondary">
              Pedido enviado em {formatCreatedAt(request.createdAt)}
            </p>
          </div>
        </div>

        <Button
          size="sm"
          disabled={acceptMutation.isPending}
          onClick={() => {
            acceptMutation.mutate(request.id);
          }}
        >
          {acceptMutation.isPending ? 'Aceitando...' : 'Aceitar pedido'}
        </Button>

        {serverError ? (
          <p role="alert" className="text-sm text-status-afk">
            {serverError}
          </p>
        ) : null}
      </div>
    </Card>
  );
}
