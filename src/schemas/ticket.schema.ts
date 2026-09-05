import { z } from 'zod';

export const createTicketSchema = z.object({
  title: z.string().min(5, { error: 'Title must be at least 5 characters' }).max(200),
  description: z.string().min(10, { error: 'Description must be at least 10 characters' }).max(5000),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  category: z.enum(['bug', 'feature', 'question', 'uncategorized', 'other']).optional(),
  customCategory: z.string().max(100).optional(),
  autoTriage: z.preprocess((val) => val === true || val === 'true', z.boolean()).optional(),
});

export const updateTicketStatusSchema = z.object({
  status: z.enum(['open', 'in_progress', 'resolved']),
  note: z.string().max(500).optional(),
});

export const ticketQuerySchema = z.object({
  search: z.string().optional(),
  status: z.enum(['open', 'in_progress', 'resolved']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  category: z.enum(['bug', 'feature', 'question', 'uncategorized', 'other']).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(10),
  sort: z.enum(['createdAt', 'priority', 'status']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export type CreateTicketInput = z.infer<typeof createTicketSchema>;
export type UpdateTicketStatusInput = z.infer<typeof updateTicketStatusSchema>;
export type TicketQuery = z.infer<typeof ticketQuerySchema>;
