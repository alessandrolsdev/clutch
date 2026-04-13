import { randomUUID } from 'node:crypto';
import { createReadStream, type ReadStream } from 'node:fs';
import { access, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { FastifyRequest } from 'fastify';

const IMAGE_CONTENT_TYPE_TO_EXTENSION = {
  'image/gif': 'gif',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
} as const;

const IMAGE_EXTENSION_TO_CONTENT_TYPE = {
  gif: 'image/gif',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
} as const;

const GENERATED_FILE_NAME_PATTERN = /^[0-9a-f-]{36}\.(gif|jpe?g|png|webp)$/;
const MEDIA_PUBLIC_PATH_PREFIX = '/api/uploads/images/';

export const MEDIA_UPLOAD_MAX_SIZE_BYTES = 5 * 1024 * 1024;
export const MEDIA_UPLOAD_ALLOWED_CONTENT_TYPES = Object.freeze(
  Object.keys(IMAGE_CONTENT_TYPE_TO_EXTENSION),
) as ReadonlyArray<UploadedImageContentType>;

export type UploadedImageContentType = keyof typeof IMAGE_CONTENT_TYPE_TO_EXTENSION;

export type UploadedImageFile = {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
};

export function resolveMediaUploadsDirectory(): string {
  const configuredDirectory = process.env['MEDIA_UPLOADS_DIR']?.trim();

  if (configuredDirectory) {
    return path.resolve(configuredDirectory);
  }

  return path.resolve(process.cwd(), 'storage', 'uploads', 'images');
}

export async function ensureMediaUploadsDirectory(): Promise<void> {
  await mkdir(resolveMediaUploadsDirectory(), { recursive: true });
}

export function detectUploadedImageContentType(
  buffer: Buffer,
): UploadedImageContentType | null {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  )) {
    return 'image/png';
  }

  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return 'image/jpeg';
  }

  if (
    buffer.length >= 6 &&
    (buffer.subarray(0, 6).toString('ascii') === 'GIF87a' ||
      buffer.subarray(0, 6).toString('ascii') === 'GIF89a')
  ) {
    return 'image/gif';
  }

  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp';
  }

  return null;
}

export function createUploadedImageFileName(
  contentType: UploadedImageContentType,
): string {
  return `${randomUUID()}.${IMAGE_CONTENT_TYPE_TO_EXTENSION[contentType]}`;
}

export function isValidStoredImageFileName(fileName: string): boolean {
  return GENERATED_FILE_NAME_PATTERN.test(fileName);
}

export function resolveStoredImageContentType(
  fileName: string,
): UploadedImageContentType | null {
  const extension = path.extname(fileName).replace('.', '').toLowerCase();
  return IMAGE_EXTENSION_TO_CONTENT_TYPE[
    extension as keyof typeof IMAGE_EXTENSION_TO_CONTENT_TYPE
  ] ?? null;
}

export async function persistUploadedImage(
  fileName: string,
  buffer: Buffer,
): Promise<void> {
  await ensureMediaUploadsDirectory();
  await writeFile(resolveUploadedImageFilePath(fileName), buffer);
}

export async function openStoredImageStream(fileName: string): Promise<{
  contentType: UploadedImageContentType;
  stream: ReadStream;
} | null> {
  if (!isValidStoredImageFileName(fileName)) {
    return null;
  }

  const contentType = resolveStoredImageContentType(fileName);

  if (!contentType) {
    return null;
  }

  const filePath = resolveUploadedImageFilePath(fileName);

  try {
    await access(filePath);
  } catch {
    return null;
  }

  return {
    contentType,
    stream: createReadStream(filePath),
  };
}

export function buildUploadedImagePublicUrl(
  request: FastifyRequest,
  fileName: string,
): string {
  const publicPath = `${MEDIA_PUBLIC_PATH_PREFIX}${fileName}`;
  const publicOrigin = resolvePublicOrigin(request);

  if (!publicOrigin) {
    return publicPath;
  }

  return new URL(publicPath, `${publicOrigin}/`).toString();
}

function resolveUploadedImageFilePath(fileName: string): string {
  return path.join(resolveMediaUploadsDirectory(), fileName);
}

function resolvePublicOrigin(request: FastifyRequest): string | null {
  const forwardedHost = readSingleHeaderValue(request.headers['x-forwarded-host']);
  const forwardedProtocol = readSingleHeaderValue(request.headers['x-forwarded-proto']);

  if (forwardedHost) {
    return `${forwardedProtocol ?? 'http'}://${forwardedHost}`;
  }

  const originHeader = readSingleHeaderValue(request.headers.origin);

  if (originHeader) {
    try {
      const parsedOrigin = new URL(originHeader);

      if (parsedOrigin.protocol === 'http:' || parsedOrigin.protocol === 'https:') {
        return parsedOrigin.origin;
      }
    } catch {
      return null;
    }
  }

  const hostHeader = readSingleHeaderValue(request.headers.host);

  if (hostHeader) {
    return `${request.protocol}://${hostHeader}`;
  }

  return null;
}

function readSingleHeaderValue(
  value: string | string[] | undefined,
): string | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return typeof value === 'string' && value.length > 0 ? value : null;
}
