# CoinX Backend

Sync server for the CoinX expense tracker app.

## Tech Stack

- **Runtime:** [Bun](https://bun.sh/)
- **Framework:** [ElysiaJS](https://elysiajs.com/)
- **Database:** PostgreSQL via [Supabase](https://supabase.com/)
- **ORM:** [Prisma](https://www.prisma.io/)
- **Auth:** Supabase Auth (JWT / JWKS)
- **Observability:** [Better Stack](https://betterstack.com/) (logs + error tracking via Sentry SDK)

## Fresh Setup

### Prerequisites

- [Bun](https://bun.sh/) v1.0+
- A [Supabase](https://supabase.com/) project (staging or production)

### 1. Install dependencies

```bash
bun install
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Fill in all values in `.env`:

| Variable                    | Where to find it                                                                                                |
| --------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`              | Supabase → Project Settings → Database → Connection String → **Pooler** (Transaction mode, port `6543`)         |
| `DIRECT_URL`                | Supabase → Project Settings → Database → Connection String → **Direct** (port `5432`) — required for migrations |
| `SUPABASE_URL`              | Supabase → Project Settings → API → **Project URL**                                                             |
| `SUPABASE_ANON_KEY`         | Supabase → Project Settings → API → Project API Keys → `anon` / `public`                                        |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → Project API Keys → `service_role` (**keep secret**)                         |
| `SUPABASE_JWT_SECRET`       | Supabase → Project Settings → API → JWT Settings → **JWT Secret**                                               |
| `BETTERSTACK_SOURCE_TOKEN`  | Better Stack → Telemetry → Source → Source token                                                                |
| `SENTRY_DSN`                | Better Stack → Telemetry → Source → Sentry DSN                                                                  |

> **Note:** If your database password contains special characters (e.g. `^`, `$`, `@`), percent-encode them in the connection string (`^` → `%5E`, `$` → `%24`).

### 3. Run database migrations

`DIRECT_URL` is used automatically by `prisma.config.ts` to bypass the connection pooler during migrations.

```bash
bun run db:migrate
```

> For production / CI, use `prisma migrate deploy` instead of `migrate dev`.

### 4. Generate Prisma client

```bash
bun run db:generate
```

### 5. Start the development server

```bash
bun run dev
```

Server starts at `http://localhost:3000`.

### 6. Verify

```bash
curl http://localhost:3000/api/health
```

Expected response includes `"status": "ok"` and database latency.

---

## Scripts

| Script                | Description                         |
| --------------------- | ----------------------------------- |
| `bun run dev`         | Development server with hot reload  |
| `bun run start`       | Production server                   |
| `bun run build`       | Build to `./dist`                   |
| `bun run db:generate` | Generate Prisma client              |
| `bun run db:migrate`  | Run migrations (dev)                |
| `bun run db:push`     | Push schema without migration files |
| `bun run db:studio`   | Open Prisma Studio GUI              |
| `bun run lint`        | Run Biome linter                    |
| `bun run type-check`  | TypeScript type check               |

---

## API Routes

### Health

| Method | Path          | Auth | Description                                                               |
| ------ | ------------- | ---- | ------------------------------------------------------------------------- |
| GET    | `/api/health` | No   | DB status, latency, and service uptime. Returns 503 if DB is unreachable. |

### Auth

| Method | Path                   | Auth | Description                                                          |
| ------ | ---------------------- | ---- | -------------------------------------------------------------------- |
| POST   | `/api/auth/register`   | JWT  | Create or update profile after Supabase sign-up (idempotent upsert). |
| GET    | `/api/auth/profile`    | JWT  | Get current user profile and registered devices.                     |
| POST   | `/api/auth/device`     | JWT  | Register a new device for sync. Returns `deviceId`.                  |
| DELETE | `/api/auth/device/:id` | JWT  | Remove a device (own devices only).                                  |

### Sync

| Method | Path             | Auth | Description                                                                                                                                |
| ------ | ---------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| POST   | `/api/sync/push` | JWT  | Upload local changes (upsert + soft-delete). Supports: transactions, categories, products, stores, productListings, productListingHistory. |
| POST   | `/api/sync/pull` | JWT  | Download changes since `lastSyncedAt`. Pass `null` for first full sync.                                                                    |

---

## Project Structure

```
src/
├── index.ts                  # App entry point (Elysia setup)
├── common/
│   ├── env.ts                # Environment variable validation
│   ├── errors.ts             # Shared error types
│   ├── middleware/
│   │   └── request-id.middleware.ts
│   └── services/
│       ├── error-tracking.ts # Better Stack / Sentry integration
│       ├── logger.ts         # Pino structured logger
│       ├── prisma.ts         # Prisma client
│       └── supabase.ts       # Supabase admin client
└── modules/
    ├── auth/                 # Auth routes + JWT guard
    ├── health/               # Health check
    └── sync/                 # Push/pull sync logic
```

## Deployment

A `Dockerfile` is included for containerised deployments. The image:

- Uses `oven/bun` as the base
- Generates the Prisma client during build
- Exposes port `3000`
- Runs `bun run start`

Set all environment variables (see step 2) in your hosting platform before deploying. `DIRECT_URL` is only needed at migration time.
