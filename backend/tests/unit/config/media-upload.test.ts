import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { resolveMediaUploadsDirectory } from '../../../src/config/media-upload';

describe('media-upload config', () => {
  afterEach(() => {
    delete process.env.MEDIA_UPLOADS_DIR;
  });

  it('usa MEDIA_UPLOADS_DIR quando a env esta definida', () => {
    process.env.MEDIA_UPLOADS_DIR = '/custom/uploads/images';

    expect(resolveMediaUploadsDirectory()).toBe(
      path.resolve('/custom/uploads/images'),
    );
  });

  it('usa um diretorio local relativo ao projeto quando a env nao esta definida', () => {
    const resolvedDirectory = resolveMediaUploadsDirectory();
    const expectedDirectory = path.resolve(
      process.cwd(),
      'storage',
      'uploads',
      'images',
    );

    expect(resolvedDirectory).toBe(expectedDirectory);
  });

  it('nao aponta para /data quando a env nao esta definida', () => {
    const resolvedDirectory = resolveMediaUploadsDirectory();

    expect(resolvedDirectory).not.toBe(
      path.resolve(path.sep, 'data', 'uploads', 'images'),
    );
  });
});
