import prisma from '../config/db.ts';
import { sseService } from './sse.service.ts';

interface CreateNotificationParams {
  userId: string;
  ticketId?: string | null;
  title: string;
  message: string;
  type?: string;
}

const statusLabel = (s: string) => s.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase());

export class NotificationService {
  /**
   * Persists a notification to the database and dispatches
   * an immediate real-time SSE event to the recipient if connected.
   */
  async createNotification(params: CreateNotificationParams) {
    try {
      const notification = await prisma.notification.create({
        data: {
          userId: params.userId,
          ticketId: params.ticketId,
          title: params.title,
          message: params.message,
          type: params.type ?? 'status_change',
        },
      });

      // Push real-time event to user
      sseService.sendToUser(params.userId, 'notification', notification);

      return notification;
    } catch (err) {
      console.error('[NotificationService] Failed to create notification:', err);
      return null;
    }
  }

  /**
   * Dispatches notifications and real-time updates when a customer creates a ticket.
   */
  async notifyAdminsOfNewTicket(ticket: { id: string; ticketId: string; title: string; priority: string; status: string }, creatorName: string) {
    try {
      // Find all admin users
      const admins = await prisma.user.findMany({
        where: { role: 'admin' },
        select: { id: true },
      });

      const title = `New Ticket #${ticket.ticketId}`;
      const message = `${creatorName} created "${ticket.title}" (${ticket.priority} priority)`;

      for (const admin of admins) {
        await this.createNotification({
          userId: admin.id,
          ticketId: ticket.id,
          title,
          message,
          type: 'ticket_created',
        });
      }

      // Notify admin clients to refresh ticket listings in real time
      sseService.sendToAdmins('ticket_created', {
        id: ticket.id,
        ticketId: ticket.ticketId,
        title: ticket.title,
        priority: ticket.priority,
        status: ticket.status,
      });
    } catch (err) {
      console.error('[NotificationService] Failed to notify admins of new ticket:', err);
    }
  }

  /**
   * Dispatches notifications and real-time updates when a ticket's status changes.
   */
  async notifyUserOfStatusChange(
    ticket: { id: string; ticketId: string; title: string; createdById: string },
    fromStatus: string,
    toStatus: string,
    note?: string
  ) {
    try {
      const formattedTo = statusLabel(toStatus);
      const title = `Ticket #${ticket.ticketId} Updated`;
      const message = `Status changed to ${formattedTo}${note ? `: "${note}"` : ''}`;

      // Notify the ticket creator
      await this.createNotification({
        userId: ticket.createdById,
        ticketId: ticket.id,
        title,
        message,
        type: 'status_change',
      });

      // Broadcast real-time ticket update event so any active viewers update without reloading
      const updatePayload = {
        id: ticket.id,
        ticketId: ticket.ticketId,
        fromStatus,
        toStatus,
        note,
      };

      sseService.sendToUser(ticket.createdById, 'ticket_updated', updatePayload);
      sseService.sendToAdmins('ticket_updated', updatePayload);
    } catch (err) {
      console.error('[NotificationService] Failed to notify user of status change:', err);
    }
  }

  /**
   * Broadcasts real-time deletion event.
   */
  broadcastTicketDeleted(ticketId: string) {
    sseService.broadcast('ticket_deleted', { id: ticketId });
  }
}

export const notificationService = new NotificationService();
