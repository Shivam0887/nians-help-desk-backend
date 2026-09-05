import type { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/ApiError.ts';

/**
 * Role-based authorization middleware factory.
 * Must be used AFTER authenticate middleware.
 */
export function authorize(...roles: ('customer' | 'admin')[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw ApiError.unauthorized('Authentication required');
    }

    if (!roles.includes(req.user.role)) {
      throw ApiError.forbidden('You do not have permission to access this resource');
    }

    next();
  };
}
