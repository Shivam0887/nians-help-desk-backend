import { Router } from 'express';
import { authenticate } from '../middleware/auth.ts';
import {
  streamNotifications,
  getNotifications,
  markAsRead,
  markAllAsRead,
} from '../controllers/notification.controller.ts';

const router = Router();

// All notification routes require authentication (supports header or ?token= query for SSE)
router.use(authenticate);

router.get('/stream', streamNotifications);
router.get('/', getNotifications);
router.patch('/read-all', markAllAsRead);
router.patch('/:id/read', markAsRead);

export default router;
