import type { Request, Response } from 'express';
import fs from 'fs';
import prisma from '../config/db.ts';
import { ApiError } from '../utils/ApiError.ts';
import { asyncHandler } from '../utils/asyncHandler.ts';
import { ticketQuerySchema } from '../schemas/ticket.schema.ts';
import type { CreateTicketInput, UpdateTicketStatusInput } from '../schemas/ticket.schema.ts';
import { cloudinary, isCloudinaryConfigured } from '../config/cloudinary.ts';
import { triageTicket } from '../services/ai-triage.service.ts';
import { sendStatusChangeEmail } from '../services/email.service.ts';
import type { Prisma, TicketStatus, Priority, Category } from '../../prisma/generated/client/index.js';

// Counter for human-readable ticket IDs
async function generateTicketId(): Promise<string> {
  const count = await prisma.ticket.count();
  return `TKT-${String(count + 1).padStart(5, '0')}`;
}

export const createTicket = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.user) throw ApiError.unauthorized();

  const { title, description, priority, category, customCategory, autoTriage } = req.body as CreateTicketInput;

  // Handle file uploads
  const attachments: { url: string; filename: string; mimetype: string; size: number }[] = [];
  const files = req.files as Express.Multer.File[] | undefined;

  if (files?.length) {
    for (const file of files) {
      if (isCloudinaryConfigured) {
        const result = await cloudinary.uploader.upload(file.path, {
          folder: 'helpdesk/attachments',
          resource_type: 'auto',
        });
        try {
          fs.unlinkSync(file.path);
        } catch {
          // ignore cleanup error
        }
        attachments.push({
          url: result.secure_url,
          filename: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
        });
      } else {
        const proto = req.get('x-forwarded-proto') || req.protocol || 'https';
        const host = req.get('host') || 'localhost:5000';
        attachments.push({
          url: `${proto}://${host}/uploads/${file.filename}`,
          filename: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
        });
      }
    }
  }

  // AI triage (non-blocking, with fallback)
  const isAiConfigured = Boolean(
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
    process.env.OPENAI_API_KEY
  );
  const aiSuggestion = await triageTicket(title, description);

  // If autoTriage toggle is turned on and LLM is configured, apply AI suggestion automatically
  const shouldApplyAi = Boolean(autoTriage && isAiConfigured && aiSuggestion.confidence > 0);
  if (shouldApplyAi) {
    aiSuggestion.applied = true;
  }

  const finalPriority: Priority = shouldApplyAi
    ? (aiSuggestion.suggestedPriority as Priority)
    : (priority ?? 'medium');

  const finalCategory: Category = shouldApplyAi
    ? (aiSuggestion.suggestedCategory as Category)
    : (category ?? 'uncategorized');

  const finalCustomCategory = !shouldApplyAi && finalCategory === 'other' ? (customCategory ?? null) : null;

  const ticketId = await generateTicketId();

  const ticket = await prisma.ticket.create({
    data: {
      ticketId,
      title,
      description,
      priority: finalPriority,
      category: finalCategory,
      customCategory: finalCustomCategory,
      createdById: req.user.userId,
      attachments: {
        create: attachments,
      },
      statusHistory: {
        create: {
          from: 'open',
          to: 'open',
          changedById: req.user.userId,
          note: shouldApplyAi ? 'Ticket created with AI auto-classification' : 'Ticket created',
        },
      },
      ...(aiSuggestion.confidence > 0 && {
        aiSuggestion: {
          create: aiSuggestion,
        },
      }),
    },
    include: {
      attachments: true,
      aiSuggestion: true,
      createdBy: { select: { id: true, name: true, email: true } },
    },
  });

  res.status(201).json({
    success: true,
    data: { ticket },
  });
});

export const getTickets = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.user) throw ApiError.unauthorized();

  const query = ticketQuerySchema.parse(req.query);
  const { search, status, priority, category, page, limit, sort, order } = query;

  const where: Prisma.TicketWhereInput = {};

  // Role-based filtering: customers see only their own tickets
  if (req.user.role === 'customer') {
    where.createdById = req.user.userId;
  }

  if (status) where.status = status;
  if (priority) where.priority = priority;
  if (category) where.category = category;

  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
      { ticketId: { contains: search, mode: 'insensitive' } },
    ];
  }

  const skip = (page - 1) * limit;

  const [tickets, total] = await Promise.all([
    prisma.ticket.findMany({
      where,
      include: {
        createdBy: { select: { id: true, name: true, email: true, avatar: true } },
        _count: { select: { attachments: true, statusHistory: true } },
      },
      orderBy: { [sort]: order },
      skip,
      take: limit,
    }),
    prisma.ticket.count({ where }),
  ]);

  res.json({
    success: true,
    data: {
      tickets,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    },
  });
});

export const getTicketById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.user) throw ApiError.unauthorized();

  const id = req.params.id as string;
  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: {
      createdBy: { select: { id: true, name: true, email: true, avatar: true } },
      attachments: true,
      statusHistory: {
        include: { changedBy: { select: { id: true, name: true } } },
        orderBy: { changedAt: 'desc' },
      },
      aiSuggestion: true,
    },
  });

  if (!ticket) {
    throw ApiError.notFound('Ticket not found');
  }

  // Customers can only view their own tickets
  if (req.user.role === 'customer' && ticket.createdById !== req.user.userId) {
    throw ApiError.forbidden('You can only view your own tickets');
  }

  res.json({
    success: true,
    data: { ticket },
  });
});

export const updateTicketStatus = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.user) throw ApiError.unauthorized();

  const id = req.params.id as string;
  const { status, note } = req.body as UpdateTicketStatusInput;

  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
    },
  });

  if (!ticket) {
    throw ApiError.notFound('Ticket not found');
  }

  if (ticket.status === status) {
    throw ApiError.badRequest(`Ticket is already ${status}`);
  }

  const updatedTicket = await prisma.ticket.update({
    where: { id },
    data: {
      status: status as TicketStatus,
      statusHistory: {
        create: {
          from: ticket.status,
          to: status as TicketStatus,
          changedById: req.user.userId,
          note,
        },
      },
    },
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
      statusHistory: {
        include: { changedBy: { select: { id: true, name: true } } },
        orderBy: { changedAt: 'desc' },
      },
    },
  });

  // Send email notification (non-blocking)
  sendStatusChangeEmail(
    ticket.createdBy.email,
    updatedTicket.ticketId,
    ticket.status,
    status,
    note
  ).catch(console.error);

  res.json({
    success: true,
    data: { ticket: updatedTicket },
  });
});

export const deleteTicket = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id as string;
  const ticket = await prisma.ticket.findUnique({ where: { id } });

  if (!ticket) {
    throw ApiError.notFound('Ticket not found');
  }

  await prisma.ticket.delete({ where: { id } });

  res.json({
    success: true,
    message: 'Ticket deleted',
  });
});

export const applyAiSuggestion = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.user) throw ApiError.unauthorized();

  const id = req.params.id as string;
  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: { aiSuggestion: true },
  });

  if (!ticket) {
    throw ApiError.notFound('Ticket not found');
  }

  if (!ticket.aiSuggestion) {
    throw ApiError.badRequest('No AI suggestion available for this ticket');
  }

  const updatedTicket = await prisma.ticket.update({
    where: { id },
    data: {
      category: ticket.aiSuggestion.suggestedCategory as Category,
      priority: ticket.aiSuggestion.suggestedPriority as Priority,
      aiSuggestion: {
        update: { applied: true },
      },
    },
    include: {
      createdBy: { select: { id: true, name: true, email: true, avatar: true } },
      attachments: true,
      statusHistory: {
        include: { changedBy: { select: { id: true, name: true } } },
        orderBy: { changedAt: 'desc' },
      },
      aiSuggestion: true,
    },
  });

  res.json({
    success: true,
    data: { ticket: updatedTicket },
  });
});

