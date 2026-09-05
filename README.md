# Nians Help Desk - Backend API

A robust REST API for the Nians Help Desk ticket management system, built with Express, TypeScript, Prisma, and PostgreSQL.

## Features

- **Authentication & Authorization**: Email/password registration, JWT sessions, Google OAuth2 integration, and role-based access control (Admin, Agent, Customer).
- **Ticket Management**: Full ticket lifecycle with priority, status, category tracking, and assignment.
- **AI Auto-Triage**: Automated category prediction, priority classification, and sentiment detection using Google Gemini or OpenAI.
- **Comments & Timeline**: Public customer updates and internal team notes with audit trails.
- **File Uploads**: Attachment support with Cloudinary integration and local filesystem fallback.
- **Admin Analytics**: Aggregated metrics for ticket volume, category distribution, and inflow trends.

## Tech Stack

- Node.js & Express 5
- TypeScript
- Prisma ORM
- PostgreSQL
- Vercel AI SDK (@ai-sdk/google, @ai-sdk/openai)
- Multer & Cloudinary
- Nodemailer

## Getting Started

### 1. Prerequisites

- Node.js 18+
- PostgreSQL database instance

### 2. Installation

```bash
npm install
```

### 3. Environment Configuration

Copy the example environment file:

```bash
cp .env.example .env
```

Configure the following variables in `.env`:

- `DATABASE_URL`: PostgreSQL connection string.
- `JWT_SECRET`: Secure secret string for signing JWT tokens.
- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`: Credentials for Google OAuth.
- `GEMINI_API_KEY` or `OPENAI_API_KEY`: API key for automated AI triage.

### 4. Database Setup

Push schema changes to your database:

```bash
npm run db:push
```

Seed initial data and default admin user:

```bash
npm run db:seed
```

### 5. Run the Server

Development mode with hot reload:

```bash
npm run dev
```

Production mode:

```bash
npm run start
```

The API server will run on `http://localhost:5000`.
