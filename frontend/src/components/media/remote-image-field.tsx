'use client';

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { normalizeRemoteUrl, isValidRemoteUrl } from '@/lib/media/remote-url';
import { cn } from '@/lib/utils/cn';

type RemoteImageFieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  placeholder?: string;
  description?: string;
  previewAlt: string;
  emptyTitle: string;
  emptyDescription: string;
  previewClassName?: string;
  previewImageClassName?: string;
  onUploadFile?: (file: File) => Promise<string>;
  acceptedFileTypes?: string;
};

type PreviewStatus = 'idle' | 'loading' | 'ready' | 'error';

export function RemoteImageField({
  id,
  label,
  value,
  onChange,
  error,
  placeholder = 'https://...',
  description,
  previewAlt,
  emptyTitle,
  emptyDescription,
  previewClassName,
  previewImageClassName,
  onUploadFile,
  acceptedFileTypes = 'image/png,image/jpeg,image/webp,image/gif',
}: RemoteImageFieldProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [clipboardFeedback, setClipboardFeedback] = useState<string | null>(null);
  const [clipboardError, setClipboardError] = useState<string | null>(null);
  const [uploadFeedback, setUploadFeedback] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [previewStatus, setPreviewStatus] = useState<PreviewStatus>('idle');
  const normalizedValue = useMemo(() => normalizeRemoteUrl(value), [value]);
  const hasRemoteUrl = isValidRemoteUrl(normalizedValue);
  const helperMessage =
    error ??
    uploadError ??
    clipboardError ??
    uploadFeedback ??
    clipboardFeedback ??
    description ??
    null;
  const helperToneClassName = error || uploadError || clipboardError
    ? 'text-status-afk'
    : uploadFeedback || clipboardFeedback
      ? 'text-status-online'
      : 'text-secondary';

  useEffect(() => {
    setClipboardFeedback(null);
    setClipboardError(null);

    if (hasRemoteUrl) {
      setPreviewStatus('loading');
      return;
    }

    setPreviewStatus('idle');
  }, [hasRemoteUrl, normalizedValue]);

  const handlePasteFromClipboard = async () => {
    if (!navigator.clipboard?.readText) {
      setClipboardFeedback(null);
      setClipboardError('Seu navegador nao liberou leitura do clipboard nesta superficie.');
      return;
    }

    try {
      const clipboardText = normalizeRemoteUrl(await navigator.clipboard.readText());

      if (clipboardText.length === 0) {
        setClipboardFeedback(null);
        setClipboardError('O clipboard esta vazio.');
        return;
      }

      onChange(clipboardText);
      setClipboardError(null);
      setClipboardFeedback('Link colado do clipboard.');
    } catch {
      setClipboardFeedback(null);
      setClipboardError('Nao foi possivel ler o clipboard agora.');
    }
  };

  const handleFileSelection = async (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const selectedFile = event.target.files?.[0];
    event.target.value = '';

    if (!selectedFile || !onUploadFile) {
      return;
    }

    setUploadError(null);
    setUploadFeedback(null);
    setClipboardFeedback(null);
    setClipboardError(null);
    setIsUploading(true);

    try {
      const uploadedUrl = normalizeRemoteUrl(await onUploadFile(selectedFile));
      onChange(uploadedUrl);
      setUploadFeedback('Imagem enviada com sucesso.');
    } catch (error) {
      setUploadFeedback(null);
      setUploadError(
        error instanceof Error && error.message.length > 0
          ? error.message
          : 'Nao foi possivel enviar a imagem agora.',
      );
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <label htmlFor={id} className="text-sm font-medium text-primary">
          {label}
        </label>
        {onUploadFile ? (
          <input
            ref={fileInputRef}
            id={`${id}-file`}
            type="file"
            accept={acceptedFileTypes}
            className="sr-only"
            aria-label={`Arquivo de imagem para ${label}`}
            onChange={(event) => {
              void handleFileSelection(event);
            }}
          />
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Input
            id={id}
            type="url"
            value={value}
            placeholder={placeholder}
            aria-invalid={Boolean(error)}
            aria-describedby={`${id}-help`}
            className="min-w-0 flex-1"
            onChange={(event) => {
              onChange(event.target.value);
            }}
          />
          {onUploadFile ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={isUploading}
              onClick={() => {
                fileInputRef.current?.click();
              }}
            >
              {isUploading ? 'Enviando...' : 'Selecionar arquivo'}
            </Button>
          ) : null}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={isUploading}
            onClick={() => {
              void handlePasteFromClipboard();
            }}
          >
            Colar link
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={normalizedValue.length === 0 || isUploading}
            onClick={() => {
              onChange('');
              setClipboardFeedback(null);
              setClipboardError(null);
              setUploadFeedback(null);
              setUploadError(null);
            }}
          >
            Limpar
          </Button>
        </div>
        {helperMessage ? (
          <p id={`${id}-help`} className={cn('text-sm leading-6', helperToneClassName)}>
            {helperMessage}
          </p>
        ) : null}
      </div>

      <Card tone="neutral" className="space-y-3">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.3em] text-secondary">Preview</p>
          <p className="text-sm text-secondary">
            {hasRemoteUrl
              ? 'O preview usa a imagem atualmente vinculada ao campo.'
              : emptyDescription}
          </p>
        </div>

        {hasRemoteUrl ? (
          <div className="space-y-3">
            <div
              className={cn(
                'overflow-hidden rounded-control border border-border bg-background-secondary',
                previewClassName,
              )}
            >
              {/* Preview local precisa aceitar hosts arbitrarios do contrato atual sem depender de remotePatterns. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={normalizedValue}
                alt={previewAlt}
                className={cn('h-full w-full object-cover', previewImageClassName)}
                onLoad={() => {
                  setPreviewStatus('ready');
                }}
                onError={() => {
                  setPreviewStatus('error');
                }}
              />
            </div>

            {previewStatus === 'loading' ? (
              <p className="text-sm text-secondary">Carregando preview da imagem...</p>
            ) : null}

            {previewStatus === 'error' ? (
              <p className="text-sm text-status-afk">
                A URL parece valida, mas o browser nao conseguiu carregar uma imagem nesse endereco.
              </p>
            ) : null}
          </div>
        ) : (
          <div
            className={cn(
              'flex min-h-32 items-center justify-center rounded-control border border-dashed border-border bg-background-secondary px-4 py-6 text-center',
              previewClassName,
            )}
          >
            <div className="space-y-1">
              <p className="text-sm font-medium text-primary">{emptyTitle}</p>
              <p className="text-sm text-secondary">{emptyDescription}</p>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
