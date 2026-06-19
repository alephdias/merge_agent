import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { uploadMiddleware } from '../middleware/upload.middleware';
import { uploadFonteSchema } from '../schemas/fonte.schema';
import * as ctrl from '../controllers/fontes.controller';

const router = Router({ mergeParams: true });

router.use(authMiddleware);

router.get('/',           ctrl.list);
router.put('/:id/select', ctrl.select);
router.delete('/:id',     ctrl.remove);
router.post(
  '/upload',
  uploadMiddleware.single('arquivo'),
  validate(uploadFonteSchema, 'body'),
  ctrl.upload,
);

export default router;
