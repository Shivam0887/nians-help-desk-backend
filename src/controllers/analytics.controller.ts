import type { Request, Response } from 'express';
import prisma from '../config/db.ts';
import { asyncHandler } from '../utils/asyncHandler.ts';
import { ApiError } from '../utils/ApiError.ts';

export const getDashboard = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.user) throw ApiError.unauthorized();

  const [
    totalTickets,
    byStatus,
    byPriority,
    byCategory,
    recentTickets,
    ticketsOverTime,
  ] = await Promise.all([
    // Total count
    prisma.ticket.count(),

    // Group by status
    prisma.ticket.groupBy({
      by: ['status'],
      _count: { status: true },
    }),

    // Group by priority
    prisma.ticket.groupBy({
      by: ['priority'],
      _count: { priority: true },
    }),

    // Group by category
    prisma.ticket.groupBy({
      by: ['category'],
      _count: { category: true },
    }),

    // Recent 5 tickets
    prisma.ticket.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
      },
    }),

    // Tickets created per day (last 30 days)
    prisma.$queryRaw`
      SELECT
        DATE(\"createdAt\") as date,
        COUNT(*)::int as count
      FROM "Ticket"
      WHERE "createdAt" >= NOW() - INTERVAL '30 days'
      GROUP BY DATE("createdAt")
      ORDER BY date ASC
    `,
  ]);

  // Calculate resolution rate
  const resolvedCount = byStatus.find((s: { status: string; _count: { status: number } }) => s.status === 'resolved')?._count.status ?? 0;
  const resolutionRate = totalTickets > 0
    ? Math.round((resolvedCount / totalTickets) * 100)
    : 0;

  res.json({
    success: true,
    data: {
      totalTickets,
      resolutionRate,
      byStatus: byStatus.map((s: { status: string; _count: { status: number } }) => ({ status: s.status, count: s._count.status })),
      byPriority: byPriority.map((p: { priority: string; _count: { priority: number } }) => ({ priority: p.priority, count: p._count.priority })),
      byCategory: byCategory.map((c: { category: string; _count: { category: number } }) => ({ category: c.category, count: c._count.category })),
      recentTickets,
      ticketsOverTime,
    },
  });

});
