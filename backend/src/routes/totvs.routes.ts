import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { uploadMiddleware } from '../middleware/upload.middleware';
import { uploadFonteSchema } from '../schemas/fonte.schema';
import * as ctrl from '../controllers/totvs.controller';

const router = Router();

router.use(authMiddleware);

router.get('/',                    ctrl.list);
router.get('/compare',             ctrl.compare);
router.get('/comparativos',        ctrl.listCompare);
router.get('/comparativos/:id',    ctrl.getCompare);
router.get('/:id',                 ctrl.getOne);
router.put('/:id/select', ctrl.select);
router.delete('/:id',     ctrl.remove);
router.post(
  '/upload',
  uploadMiddleware.single('arquivo'),
  validate(uploadFonteSchema, 'body'),
  ctrl.upload,
);

export default router;
