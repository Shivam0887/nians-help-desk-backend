import { Router } from 'express';
import { authenticate } from '../middleware/auth.ts';
import { authorize } from '../middleware/authorize.ts';
import { validate } from '../middleware/validate.ts';
import { upload } from '../middleware/upload.ts';
import { createTicketSchema, updateTicketStatusSchema } from '../schemas/ticket.schema.ts';
import {
  createTicket,
  getTickets,
  getTicketById,
  updateTicketStatus,
  deleteTicket,
  applyAiSuggestion,
} from '../controllers/ticket.controller.ts';

const router = Router();

// All ticket routes require authentication
router.use(authenticate);

router.post(
  '/',
  authorize('customer'),
  upload.array('attachments', 3),
  validate(createTicketSchema),
  createTicket
);

router.get('/', getTickets);

router.get('/ai-config', (req, res) => {
  const isConfigured = Boolean(
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
    process.env.OPENAI_API_KEY
  );
  const provider = (process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY)
    ? 'gemini'
    : (process.env.OPENAI_API_KEY ? 'openai' : null);
  const model = process.env.GEMINI_MODEL || process.env.OPENAI_MODEL || process.env.AI_MODEL || 'gemini-1.5-flash';

  res.json({
    success: true,
    data: {
      isConfigured,
      provider,
      model,
    },
  });
});

router.get('/:id', getTicketById);

router.patch(
  '/:id/status',
  authorize('admin'),
  validate(updateTicketStatusSchema),
  updateTicketStatus
);

router.post(
  '/:id/apply-ai-suggestion',
  authorize('admin'),
  applyAiSuggestion
);

router.delete('/:id', authorize('admin'), deleteTicket);

export default router;
