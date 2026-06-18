import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { createMergeSchema } from '../schemas/merge.schema';
import * as ctrl from '../controllers/merges.controller';

const router = Router();

router.use(authMiddleware);

router.get('/',              ctrl.list);
router.get('/:id/report',    ctrl.getReport);
router.get('/:id/download',  ctrl.download);
router.get('/:id',           ctrl.getOne);
router.post('/', validate(createMergeSchema), ctrl.create);

export default router;
