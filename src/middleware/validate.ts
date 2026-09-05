import type { Request, Response, NextFunction } from 'express';
import type { ZodType } from 'zod';
import { z } from 'zod';

/**
 * Middleware factory that validates req.body against a Zod schema.
 * On failure, returns 400 with flattened field errors.
 * On success, replaces req.body with the parsed (cleaned) data.
 */
export function validate<T>(schema: ZodType<T>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const flattened = z.flattenError(result.error);
      _res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: flattened.fieldErrors,
      });
      return;
    }

    req.body = result.data;
    next();
  };
}
