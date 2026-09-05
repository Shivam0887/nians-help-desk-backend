import express from 'express';
import cors from 'cors';
import path from 'path';
import passport from './config/passport.ts';
import { env } from './config/env.ts';
import { errorHandler } from './middleware/errorHandler.ts';
import authRoutes from './routes/auth.routes.ts';
import ticketRoutes from './routes/ticket.routes.ts';
import analyticsRoutes from './routes/analytics.routes.ts';

const app = express();

// Core middleware
app.use(cors({ origin: env.CLIENT_URL, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(passport.initialize());

// Static file serving for local uploads
app.use('/uploads', express.static(path.resolve('uploads')));

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/analytics', analyticsRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Global error handler (must be last)
app.use(errorHandler);

export default app;
