import { Router } from 'express';
import { signup, login, googleAuth, googleCallback, getMe } from '../controllers/auth.controller.ts';
import { validate } from '../middleware/validate.ts';
import { authenticate } from '../middleware/auth.ts';
import { signupSchema, loginSchema } from '../schemas/auth.schema.ts';

const router = Router();

router.post('/signup', validate(signupSchema), signup);
router.post('/login', validate(loginSchema), login);
router.get('/google', googleAuth);
router.get('/google/callback', googleCallback);
router.get('/me', authenticate, getMe);

export default router;
