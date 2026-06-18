import multer from 'multer';
import type { Request } from 'express';
import type { FileFilterCallback } from 'multer';
import { ValidationError } from '../errors/AppError';

const ALLOWED_EXTENSIONS = new Set(['.prw', '.tlpp', '.prx']);
const MAX_SIZE_MB = 10;

function fileFilter(_req: Request, file: Express.Multer.File, cb: FileFilterCallback): void {
  const ext = `.${file.originalname.split('.').pop()?.toLowerCase() ?? ''}`;
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    cb(
      new ValidationError(
        `Extensão inválida. Permitido: ${[...ALLOWED_EXTENSIONS].join(', ')}`,
      ),
    );
    return;
  }
  cb(null, true);
}

export const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIZE_MB * 1024 * 1024, files: 1 },
  fileFilter,
});
