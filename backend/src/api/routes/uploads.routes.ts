import type { FastifyInstance } from 'fastify';
import {
  buildUploadedImagePublicUrl,
  createUploadedImageFileName,
  detectUploadedImageContentType,
  MEDIA_UPLOAD_MAX_SIZE_BYTES,
  openStoredImageStream,
  persistUploadedImage,
} from '../../config/media-upload';

export async function uploadRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Params: { filename: string } }>(
    '/images/:filename',
    async (request, reply) => {
      const storedImage = await openStoredImageStream(request.params.filename);

      if (!storedImage) {
        return reply.status(404).send({ message: 'Imagem não encontrada.' });
      }

      reply.header('Content-Type', storedImage.contentType);
      reply.header('Cache-Control', 'public, max-age=31536000, immutable');

      return reply.send(storedImage.stream);
    },
  );

  app.post(
    '/images',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      let uploadedFile;

      try {
        uploadedFile = await request.file({
          throwFileSizeLimit: true,
          limits: {
            files: 1,
            fileSize: MEDIA_UPLOAD_MAX_SIZE_BYTES,
          },
        });
      } catch (error) {
        if (error instanceof app.multipartErrors.RequestFileTooLargeError) {
          request.log.warn(
            {
              event: 'media_upload_rejected',
              requestId: request.id,
              userId: request.userId,
              status: 413,
              errorCode: 'file_too_large',
            },
            'Image upload rejected',
          );

          return reply.status(413).send({
            message: 'A imagem excede o limite de 5 MB.',
          });
        }

        throw error;
      }

      if (!uploadedFile) {
        return reply
          .status(400)
          .send({ message: 'Envie uma imagem no campo "file".' });
      }

      let uploadedBuffer: Buffer;

      try {
        uploadedBuffer = await uploadedFile.toBuffer();
      } catch (error) {
        if (error instanceof app.multipartErrors.RequestFileTooLargeError) {
          request.log.warn(
            {
              event: 'media_upload_rejected',
              requestId: request.id,
              userId: request.userId,
              status: 413,
              errorCode: 'file_too_large',
            },
            'Image upload rejected',
          );

          return reply.status(413).send({
            message: 'A imagem excede o limite de 5 MB.',
          });
        }

        throw error;
      }

      if (uploadedFile.fieldname !== 'file') {
        return reply
          .status(400)
          .send({ message: 'Envie uma imagem no campo "file".' });
      }

      const detectedContentType = detectUploadedImageContentType(uploadedBuffer);

      if (!detectedContentType) {
        request.log.warn(
          {
            event: 'media_upload_invalid_signature',
            requestId: request.id,
            userId: request.userId,
            status: 400,
            declaredContentType: uploadedFile.mimetype,
            size: uploadedBuffer.byteLength,
          },
          'Image upload rejected because the file signature is invalid',
        );

        return reply.status(400).send({
          message: 'Envie uma imagem PNG, JPEG, GIF ou WEBP válida.',
        });
      }

      const fileName = createUploadedImageFileName(detectedContentType);
      await persistUploadedImage(fileName, uploadedBuffer);

      request.log.info(
        {
          event: 'media_upload_completed',
          requestId: request.id,
          userId: request.userId,
          fileName,
          contentType: detectedContentType,
          size: uploadedBuffer.byteLength,
        },
        'Image upload completed',
      );

      return reply.status(201).send({
        url: buildUploadedImagePublicUrl(request, fileName),
        contentType: detectedContentType,
        size: uploadedBuffer.byteLength,
      });
    },
  );
}
