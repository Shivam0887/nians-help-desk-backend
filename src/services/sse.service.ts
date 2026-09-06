import type { Response } from 'express';

interface SseClient {
  res: Response;
  role: 'customer' | 'admin';
}

class SseService {
  private clients: Map<string, Set<SseClient>> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.startHeartbeat();
  }

  /**
   * Periodically sends a comment ping to keep long-lived connections alive
   * through cloud load balancers and reverse proxies (e.g., Render, Nginx).
   */
  private startHeartbeat(): void {
    if (this.heartbeatInterval) return;

    this.heartbeatInterval = setInterval(() => {
      for (const [userId, clientSet] of this.clients.entries()) {
        for (const client of clientSet) {
          try {
            client.res.write(': ping\n\n');
          } catch (err) {
            console.warn(`[SseService] Failed to send ping to user ${userId}, removing connection:`, err);
            clientSet.delete(client);
          }
        }
        if (clientSet.size === 0) {
          this.clients.delete(userId);
        }
      }
    }, 25000);
  }

  public addClient(userId: string, role: 'customer' | 'admin', res: Response): void {
    let clientSet = this.clients.get(userId);
    if (!clientSet) {
      clientSet = new Set();
      this.clients.set(userId, clientSet);
    }

    const client: SseClient = { res, role };
    clientSet.add(client);

    console.log(`[SseService] Connected client for user ${userId} (${role}). Active user sessions: ${clientSet.size}`);
  }

  public removeClient(userId: string, res: Response): void {
    const clientSet = this.clients.get(userId);
    if (!clientSet) return;

    for (const client of clientSet) {
      if (client.res === res) {
        clientSet.delete(client);
        break;
      }
    }

    if (clientSet.size === 0) {
      this.clients.delete(userId);
    }

    console.log(`[SseService] Disconnected client for user ${userId}. Remaining sessions: ${clientSet?.size ?? 0}`);
  }

  public sendToUser(userId: string, event: string, data: unknown): void {
    const clientSet = this.clients.get(userId);
    if (!clientSet || clientSet.size === 0) return;

    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

    for (const client of clientSet) {
      try {
        client.res.write(payload);
      } catch (err) {
        console.warn(`[SseService] Error sending to user ${userId}:`, err);
        clientSet.delete(client);
      }
    }

    if (clientSet.size === 0) {
      this.clients.delete(userId);
    }
  }

  public sendToAdmins(event: string, data: unknown): void {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

    for (const [userId, clientSet] of this.clients.entries()) {
      for (const client of clientSet) {
        if (client.role === 'admin') {
          try {
            client.res.write(payload);
          } catch (err) {
            console.warn(`[SseService] Error sending to admin ${userId}:`, err);
            clientSet.delete(client);
          }
        }
      }
      if (clientSet.size === 0) {
        this.clients.delete(userId);
      }
    }
  }

  public broadcast(event: string, data: unknown): void {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

    for (const [userId, clientSet] of this.clients.entries()) {
      for (const client of clientSet) {
        try {
          client.res.write(payload);
        } catch (err) {
          console.warn(`[SseService] Error broadcasting to user ${userId}:`, err);
          clientSet.delete(client);
        }
      }
      if (clientSet.size === 0) {
        this.clients.delete(userId);
      }
    }
  }
}

export const sseService = new SseService();
