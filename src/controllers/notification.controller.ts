import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.ts';
import { ApiError } from '../utils/ApiError.ts';
import prisma from '../config/db.ts';
import { sseService } from '../services/sse.service.ts';

/**
 * Server-Sent Events (SSE) connection stream endpoint.
 * Keeps an open HTTP connection to stream real-time events to the authenticated user.
 */
export const streamNotifications = (req: Request, res: Response): void => {
  const user = req.user;
  if (!user?.userId) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  // Set SSE response headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable proxy buffering for Nginx/Render
  res.flushHeaders?.();

  // Send initial handshake
  res.write(`event: connected\ndata: ${JSON.stringify({ status: 'connected', userId: user.userId })}\n\n`);

  // Register client with SSE manager
  sseService.addClient(user.userId, user.role, res);

  // Clean up on disconnect
  req.on('close', () => {
    sseService.removeClient(user.userId, res);
  });
};

/**
 * Retrieves paginated notifications and unread count for the current user.
 */
export const getNotifications = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.user) throw ApiError.unauthorized();
  const userId = req.user.userId;

  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 30,
    }),
    prisma.notification.count({
      where: { userId, read: false },
    }),
  ]);

  res.json({
    success: true,
    data: {
      notifications,
      unreadCount,
    },
  });
});

/**
 * Marks a specific notification as read.
 */
export const markAsRead = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.user) throw ApiError.unauthorized();
  const userId = req.user.userId;
  const id = req.params.id as string;

  await prisma.notification.updateMany({
    where: { id, userId },
    data: { read: true },
  });

  res.json({
    success: true,
    message: 'Notification marked as read',
  });
});

/**
 * Marks all notifications for the current user as read.
 */
export const markAllAsRead = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.user) throw ApiError.unauthorized();
  const userId = req.user.userId;

  await prisma.notification.updateMany({
    where: { userId, read: false },
    data: { read: true },
  });

  res.json({
    success: true,
    message: 'All notifications marked as read',
  });
});
