import os from 'node:os';
import path from 'node:path';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import supertest from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { buildApp, generateTestToken } from '../../helpers/build-app';
import { MEDIA_UPLOAD_MAX_SIZE_BYTES } from '@/config/media-upload';

const tinyPngBuffer = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WnKgmwAAAAASUVORK5CYII=',
  'base64',
);

let uploadsDirectory: string | null = null;

describe('Uploads Routes', () => {
  afterEach(async () => {
    delete process.env.MEDIA_UPLOADS_DIR;

    if (uploadsDirectory) {
      await rm(uploadsDirectory, { force: true, recursive: true });
      uploadsDirectory = null;
    }
  });

  it('armazena a imagem enviada e devolve a URL publica proxied', async () => {
    uploadsDirectory = await mkdtemp(path.join(os.tmpdir(), 'clutch-upload-test-'));
    process.env.MEDIA_UPLOADS_DIR = uploadsDirectory;

    const app = await buildApp();
    const token = generateTestToken(app);

    const response = await supertest(app.server)
      .post('/uploads/images')
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', 'http://localhost')
      .attach('file', tinyPngBuffer, {
        contentType: 'image/png',
        filename: 'avatar.png',
      });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      contentType: 'image/png',
      size: tinyPngBuffer.length,
    });
    expect(response.body.url).toMatch(
      /^http:\/\/localhost\/api\/uploads\/images\/[0-9a-f-]+\.png$/,
    );

    const storedFileName = new URL(response.body.url).pathname.split('/').pop();

    expect(typeof storedFileName).toBe('string');

    const storedFile = await readFile(path.join(uploadsDirectory, storedFileName as string));
    expect(storedFile.equals(tinyPngBuffer)).toBe(true);

    const imageResponse = await app.inject({
      method: 'GET',
      url: `/uploads/images/${storedFileName}`,
    });

    expect(imageResponse.statusCode).toBe(200);
    expect(imageResponse.headers['content-type']).toContain('image/png');

    await app.close();
  });

  it('rejeita arquivos que nao sao imagens validas', async () => {
    uploadsDirectory = await mkdtemp(path.join(os.tmpdir(), 'clutch-upload-test-'));
    process.env.MEDIA_UPLOADS_DIR = uploadsDirectory;

    const app = await buildApp();
    const token = generateTestToken(app);

    const response = await supertest(app.server)
      .post('/uploads/images')
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', 'http://localhost')
      .attach('file', Buffer.from('not-an-image'), {
        contentType: 'text/plain',
        filename: 'notes.txt',
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      message: 'Envie uma imagem PNG, JPEG, GIF ou WEBP válida.',
    });

    await app.close();
  });

  it('rejeita imagens acima do limite configurado', async () => {
    uploadsDirectory = await mkdtemp(path.join(os.tmpdir(), 'clutch-upload-test-'));
    process.env.MEDIA_UPLOADS_DIR = uploadsDirectory;

    const app = await buildApp();
    const token = generateTestToken(app);

    const response = await supertest(app.server)
      .post('/uploads/images')
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', 'http://localhost')
      .attach('file', Buffer.alloc(MEDIA_UPLOAD_MAX_SIZE_BYTES + 1, 0x00), {
        contentType: 'image/png',
        filename: 'large.png',
      });

    expect(response.status).toBe(413);
    expect(response.body).toEqual({
      message: 'A imagem excede o limite de 5 MB.',
    });

    await app.close();
  });
});
