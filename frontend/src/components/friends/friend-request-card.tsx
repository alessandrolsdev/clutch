'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { HydrationSafeTime } from '@/components/ui/hydration-safe-time';
import { useToast } from '@/components/ui/toaster';
import {
  applyAcceptedFriendRequest,
  applyProfileFriendCountDelta,
  buildOptimisticFriendSummary,
  restoreQuerySnapshots,
  snapshotQueryGroups,
} from '@/lib/query/social-cache';
import { type PendingFriendRequest } from '@/schemas/friends';
import {
  acceptFriendRequest,
  FriendsRequestError,
} from '@/services/friends';

type FriendRequestCardProps = {
  request: PendingFriendRequest;
  receiverUserId: string;
  receiverUsername: string;
};

export function FriendRequestCard({
  request,
  receiverUserId,
  receiverUsername,
}: FriendRequestCardProps) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const senderName =
    request.sender.profile?.displayName && request.sender.profile.displayName.length > 0
      ? request.sender.profile.displayName
      : request.sender.username;
  const avatarFallback = request.sender.username.slice(0, 2).toUpperCase();

  const acceptMutation = useMutation({
    mutationFn: acceptFriendRequest,
    onMutate: async () => {
      await Promise.all([
        queryClient.cancelQueries({
          queryKey: ['friend-requests', receiverUserId],
        }),
        queryClient.cancelQueries({
          queryKey: ['friends', receiverUserId],
        }),
        queryClient.cancelQueries({
          queryKey: ['profile'],
        }),
      ]);

      const snapshots = snapshotQueryGroups(queryClient, [
        ['friend-requests', receiverUserId],
        ['friends', receiverUserId],
        ['profile'],
      ]);

      applyAcceptedFriendRequest(
        queryClient,
        receiverUserId,
        request,
        buildOptimisticFriendSummary(queryClient, {
          id: receiverUserId,
          username: receiverUsername,
        }),
      );
      applyProfileFriendCountDelta(queryClient, [receiverUserId, request.sender.id], 1);

      return { snapshots };
    },
    onSuccess: () => {
      showToast({
        title: 'Pedido aceito',
        description: 'A amizade ja pode aparecer nas superfices sociais do app.',
        tone: 'success',
      });
    },
    onError: (error, _requestId, context) => {
      if (context) {
        restoreQuerySnapshots(queryClient, context.snapshots);
      }

      showToast({
        title: 'Nao foi possivel aceitar o pedido',
        description: error instanceof FriendsRequestError
          ? error.message
          : 'Tente novamente em alguns instantes.',
        tone: 'error',
      });
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['profile'],
        refetchType: 'active',
      });
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
              Pedido enviado em{' '}
              <HydrationSafeTime
                value={request.createdAt}
                options={{ dateStyle: 'short', timeStyle: 'short' }}
                fallback={request.createdAt}
              />
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
