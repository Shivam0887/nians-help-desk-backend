import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.ts';
import { ApiError } from '../utils/ApiError.ts';

export interface JwtPayload {
  userId: string;
  email: string;
  role: 'customer' | 'admin';
  name?: string;
}

declare global {
  namespace Express {
    interface User {
      userId: string;
      id?: string;
      email: string;
      role: 'customer' | 'admin';
      name?: string;
      avatar?: string | null;
    }
  }
}



/**
 * Verifies the JWT from the Authorization header and attaches the decoded
 * payload to req.user. Rejects if token is missing, expired, or invalid.
 */
export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  let token = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.split(' ')[1]
    : undefined;

  // Support token in query parameter for EventSource / SSE connections
  if (!token && typeof req.query.token === 'string') {
    token = req.query.token;
  }

  if (!token) {
    throw ApiError.unauthorized('Missing or malformed authorization header');
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    req.user = decoded;
    next();
  } catch {
    throw ApiError.unauthorized('Invalid or expired token');
  }
}
