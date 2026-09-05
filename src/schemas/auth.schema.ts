import { z } from 'zod';

export const signupSchema = z.object({
  name: z.string().min(2, { error: 'Name must be at least 2 characters' }).max(100),
  email: z.string().email({ error: 'Invalid email address' }),
  password: z.string().min(6, { error: 'Password must be at least 6 characters' }).max(128),
});

export const loginSchema = z.object({
  email: z.string().email({ error: 'Invalid email address' }),
  password: z.string().min(1, { error: 'Password is required' }),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
