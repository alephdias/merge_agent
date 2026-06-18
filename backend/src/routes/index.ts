import { Router } from 'express';
import authRouter    from './auth.routes';
import empresasRouter from './empresas.routes';
import totvsRouter   from './totvs.routes';
import fontesRouter  from './fontes.routes';
import mergesRouter  from './merges.routes';

const router = Router();

router.use('/auth',                       authRouter);
router.use('/empresas',                   empresasRouter);
router.use('/totvs',                      totvsRouter);
router.use('/empresas/:empresaId/fontes', fontesRouter);
router.use('/merges',                     mergesRouter);

export default router;
