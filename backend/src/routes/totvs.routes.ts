import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { uploadMiddleware } from '../middleware/upload.middleware';
import { uploadFonteSchema } from '../schemas/fonte.schema';
import * as ctrl from '../controllers/totvs.controller';

const router = Router();

router.use(authMiddleware);

router.get('/',     ctrl.list);
router.get('/:id',  ctrl.getOne);
router.post(
  '/upload',
  uploadMiddleware.single('arquivo'),
  validate(uploadFonteSchema, 'body'),
  ctrl.upload,
);

export default router;
