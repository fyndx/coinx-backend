# CoinX Backend

Sync server for the CoinX expense tracker app.

## Tech Stack

- **Runtime:** [Bun](https://bun.sh/)
- **Framework:** [ElysiaJS](https://elysiajs.com/)
- **Database:** PostgreSQL (Supabase)
- **ORM:** [Prisma](https://www.prisma.io/)
- **Auth:** Supabase Auth

## Setup

### Prerequisites

- [Bun](https://bun.sh/) v1.0+
- Supabase project

### Install

```bash
bun install
```

### Environment Variables

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

### Database

Generate Prisma client:

```bash
bun run db:generate
```

Run migrations:

```bash
bun run db:migrate
```

### Development

```bash
bun run dev
```

Server starts at `http://localhost:3000`.

### Health Check

```bash
curl http://localhost:3000/api/health
```

## API Routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/health` | No | Health check + DB status |

*More routes coming in Phase 1.*

## Project Structure

```
src/
├── index.ts          # Entry point
├── routes/           # Route handlers
├── middleware/        # Auth, etc.
├── services/         # Business logic
├── lib/              # Prisma, Supabase clients
└── types/            # Shared types
```
