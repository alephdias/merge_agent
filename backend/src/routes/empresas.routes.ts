import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { createEmpresaSchema, updateEmpresaSchema } from '../schemas/empresa.schema';
import * as ctrl from '../controllers/empresas.controller';

const router = Router();

router.use(authMiddleware);

router.get('/',     ctrl.list);
router.get('/:id',  ctrl.getOne);
router.post('/',    validate(createEmpresaSchema), ctrl.create);
router.put('/:id',  validate(updateEmpresaSchema), ctrl.update);
router.delete('/:id', ctrl.remove);

export default router;
