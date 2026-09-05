import type { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import passport from 'passport';
import prisma from '../config/db.ts';
import { env } from '../config/env.ts';
import { ApiError } from '../utils/ApiError.ts';
import { asyncHandler } from '../utils/asyncHandler.ts';
import type { SignupInput, LoginInput } from '../schemas/auth.schema.ts';
import type { JwtPayload } from '../middleware/auth.ts';

function generateToken(user: { id: string; email: string; role: string }): string {
  const payload: JwtPayload = {
    userId: user.id,
    email: user.email,
    role: user.role as 'customer' | 'admin',
  };

  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as any,
  });

}

function sanitizeUser(user: { id: string; name: string; email: string; role: string; avatar: string | null }) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    avatar: user.avatar,
  };
}

export const signup = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { name, email, password } = req.body as SignupInput;

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    throw ApiError.badRequest('A user with this email already exists');
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: {
      name,
      email,
      password: hashedPassword,
      role: 'customer',
    },
  });

  const token = generateToken(user);

  res.status(201).json({
    success: true,
    data: {
      user: sanitizeUser(user),
      token,
    },
  });
});

export const login = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body as LoginInput;

  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || !user.password) {
    throw ApiError.unauthorized('Invalid email or password');
  }

  const isMatch = await bcrypt.compare(password, user.password);

  if (!isMatch) {
    throw ApiError.unauthorized('Invalid email or password');
  }

  const token = generateToken(user);

  res.json({
    success: true,
    data: {
      user: sanitizeUser(user),
      token,
    },
  });
});

export const googleAuth = passport.authenticate('google', {
  scope: ['profile', 'email'],
  session: false,
});

export const googleCallback = (req: Request, res: Response): void => {
  passport.authenticate('google', { session: false }, (err: Error | null, user: any) => {
    if (err || !user) {
      res.redirect(`${env.CLIENT_URL}/login?error=google_auth_failed`);
      return;
    }

    const token = generateToken(user);
    res.redirect(`${env.CLIENT_URL}/auth/callback?token=${token}`);
  })(req, res);
};

export const getMe = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    throw ApiError.unauthorized();
  }

  const user = await prisma.user.findUnique({
    where: { id: req.user.userId },
    select: { id: true, name: true, email: true, role: true, avatar: true, createdAt: true },
  });

  if (!user) {
    throw ApiError.notFound('User not found');
  }

  res.json({
    success: true,
    data: { user },
  });
});
