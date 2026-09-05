import { Router } from 'express';
import { authenticate } from '../middleware/auth.ts';
import { authorize } from '../middleware/authorize.ts';
import { getDashboard } from '../controllers/analytics.controller.ts';

const router = Router();

router.use(authenticate);
router.use(authorize('admin'));

router.get('/dashboard', getDashboard);

export default router;
