'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { type InteractionType } from '@/schemas/feed';
import { FeedRequestError, togglePostInteraction } from '@/services/feed';

type ReactionBarProps = {
  postId: string;
  initialReactionCount: number;
  canInteract: boolean;
};

const reactionOptions: Array<{
  type: InteractionType;
  label: string;
  emoji: string;
}> = [
  { type: 'GG', label: 'GG', emoji: '⚡' },
  { type: 'F', label: 'F', emoji: '💀' },
  { type: 'CLAP', label: 'Clap', emoji: '👏' },
  { type: 'HYPE', label: 'Hype', emoji: '🔥' },
  { type: 'LIKE', label: 'Like', emoji: '❤️' },
];

export function ReactionBar({
  postId,
  initialReactionCount,
  canInteract,
}: ReactionBarProps) {
  const queryClient = useQueryClient();
  const [reactionCount, setReactionCount] = useState(initialReactionCount);
  const [selectedTypes, setSelectedTypes] = useState<InteractionType[]>([]);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    setReactionCount(initialReactionCount);
  }, [initialReactionCount]);

  useEffect(() => {
    setSelectedTypes([]);
  }, [postId]);

  const toggleReactionMutation = useMutation({
    mutationFn: togglePostInteraction,
    onSuccess: async ({ added }, variables) => {
      setServerError(null);
      setReactionCount((current) => Math.max(0, current + (added ? 1 : -1)));
      setSelectedTypes((current) => {
        const next = new Set(current);

        if (added) {
          next.add(variables.type);
        } else {
          next.delete(variables.type);
        }

        return Array.from(next);
      });

      await queryClient.invalidateQueries({
        queryKey: ['feed'],
      });
    },
    onError: (error) => {
      if (error instanceof FeedRequestError) {
        setServerError(error.message);
        return;
      }

      setServerError('Nao foi possivel reagir a este post agora.');
    },
  });

  return (
    <div className="space-y-3" data-testid="reaction-bar">
      <div className="flex flex-wrap items-center gap-2">
        {reactionOptions.map((option) => {
          const isSelected = selectedTypes.includes(option.type);

          return (
            <Button
              key={option.type}
              size="sm"
              variant={isSelected ? 'primary' : 'secondary'}
              disabled={!canInteract || toggleReactionMutation.isPending}
              aria-pressed={isSelected}
              onClick={() => {
                setServerError(null);
                toggleReactionMutation.mutate({
                  postId,
                  type: option.type,
                });
              }}
            >
              <span aria-hidden="true">{option.emoji}</span>
              <span>{option.label}</span>
            </Button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-secondary">
        <span>{reactionCount} reacoes no total</span>
        {!canInteract ? (
          <span>Voce nao pode reagir ao proprio post.</span>
        ) : null}
      </div>

      {serverError ? (
        <p role="alert" className="text-sm text-status-afk">
          {serverError}
        </p>
      ) : null}
    </div>
  );
}
