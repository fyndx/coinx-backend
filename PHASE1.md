# Phase 1: Foundation — Finalized Plan

**Decisions:**
- Backend: ElysiaJS (Bun runtime)
- Database: Supabase Postgres (via Prisma)
- Auth: Supabase Auth (email/password + Google OAuth)
- Auth is optional — app works locally without signup
- Devices table: Yes (track sync source)
- Conflict resolution: Last-write-wins
- Sync: Background
- Pricing: ₹99/month (beta)

---

## Task Breakdown

### Task 1: Project Setup
**PR: `feat/project-setup`**

Set up ElysiaJS server with proper project structure.

```
coinx-backend/
├── src/
│   ├── index.ts          # Entry point
│   ├── routes/           # Route handlers
│   │   ├── auth.ts       # Auth routes
│   │   ├── sync.ts       # Sync routes
│   │   └── health.ts     # Health check
│   ├── middleware/
│   │   └── auth.ts       # JWT verification middleware
│   ├── services/         # Business logic
│   │   ├── auth.ts
│   │   └── sync.ts
│   ├── lib/
│   │   ├── prisma.ts     # Prisma client
│   │   └── supabase.ts   # Supabase admin client
│   └── types/            # Shared types
│       └── index.ts
├── prisma/
│   └── schema.prisma
├── .env
├── .env.example
├── package.json
├── tsconfig.json
└── README.md
```

**Changes:**
- Install ElysiaJS + dependencies (elysia, @elysiajs/cors, @elysiajs/jwt)
- Create basic server with health check endpoint
- Configure CORS for app
- Set up environment variable loading
- Update package.json scripts (dev, start, build)

**Acceptance:**
- `bun run dev` starts server
- `GET /health` returns 200

---

### Task 2: Schema Migration — New Tables
**PR: `feat/schema-user-device`**

Add user-related tables to the database.

**New tables:**

```prisma
model Profile {
  id          String    @id @db.Uuid   // matches auth.users(id)
  displayName String?   @map("display_name")
  avatarUrl   String?   @map("avatar_url")
  createdAt   DateTime  @default(now()) @map("created_at")
  updatedAt   DateTime? @updatedAt @map("updated_at")

  devices     Device[]

  @@map("profiles")
}

model Device {
  id         String    @id @default(uuid()) @db.Uuid
  userId     String    @map("user_id") @db.Uuid
  deviceName String?   @map("device_name")
  platform   String?   // 'ios' | 'android'
  appVersion String?   @map("app_version")
  lastSyncAt DateTime? @map("last_sync_at")
  createdAt  DateTime  @default(now()) @map("created_at")

  user       Profile   @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@map("devices")
}
```

**Acceptance:**
- Migration runs cleanly
- Tables exist in Supabase

---

### Task 3: Schema Migration — Sync Fields
**PR: `feat/schema-sync-fields`**

Add sync-related columns to ALL existing tables.

**Add to every table:**
- `user_id UUID` — who owns this data
- `deleted_at TIMESTAMPTZ` — soft delete for sync
- `sync_version INT DEFAULT 0` — increments on each change

**Add `updated_at` where missing:**
- `products` — missing updated_at
- `product_listings_history` — missing updated_at

**Add indexes:**
- `user_id` on all tables
- `updated_at` on all tables
- `deleted_at` on all tables

**RLS Policies (SQL migration):**
```sql
-- Enable RLS on all tables
ALTER TABLE coinx_transaction ENABLE ROW LEVEL SECURITY;

-- Users can only see their own data
CREATE POLICY "Users see own data" ON coinx_transaction
  FOR ALL USING (user_id = auth.uid());

-- Repeat for all tables
```

**Acceptance:**
- All tables have user_id, deleted_at, sync_version
- RLS policies active
- Existing data unaffected (user_id nullable during migration)

---

### Task 4: Auth Middleware
**PR: `feat/auth-middleware`**

JWT verification for protected routes.

**What it does:**
1. Extract Bearer token from Authorization header
2. Verify JWT with Supabase JWT secret
3. Extract user_id from token
4. Attach user to request context
5. Return 401 if invalid/missing

```typescript
// Usage in routes
app.get('/api/sync/pull', ({ user }) => {
  // user.id is guaranteed to exist here
}, { auth: true })
```

**Also includes:**
- Supabase admin client setup (for server-side operations)
- Prisma client singleton

**Acceptance:**
- Protected routes return 401 without token
- Protected routes return user context with valid token
- Unprotected routes (health) work without token

---

### Task 5: Auth Routes
**PR: `feat/auth-routes`**

User registration and device management endpoints.

**Endpoints:**

```
POST /api/auth/register
  - Creates profile in our DB after Supabase signup
  - Body: { supabaseUserId, displayName? }

POST /api/auth/device
  - Register a device for sync
  - Body: { deviceName?, platform, appVersion? }
  - Returns: { deviceId }

GET  /api/auth/profile
  - Get current user profile + devices

DELETE /api/auth/device/:id
  - Remove a device
```

**Note:** Actual signup/login happens via Supabase client in the app. These routes handle our DB-side profile and device management.

**Acceptance:**
- Can register profile after Supabase signup
- Can register device
- Can fetch profile with devices
- All routes require auth (except what Supabase handles)

---

### Task 6: Sync Endpoints — Push
**PR: `feat/sync-push`**

Upload local changes to server.

```
POST /api/sync/push
  Auth: required
  Body: {
    deviceId: string,
    lastSyncedAt: string | null,   // ISO timestamp
    changes: {
      transactions: { upserted: [], deleted: [] },
      categories: { upserted: [], deleted: [] },
      products: { upserted: [], deleted: [] },
      stores: { upserted: [], deleted: [] },
      product_listings: { upserted: [], deleted: [] },
      product_listings_history: { upserted: [], deleted: [] }
    }
  }
  Response: {
    syncedAt: string,     // server timestamp
    conflicts: []         // empty for last-write-wins
  }
```

**Logic:**
1. Validate all records belong to user (or are new)
2. For each upserted record:
   - If exists on server: compare `updated_at`, last-write-wins
   - If new: insert with user_id
3. For each deleted record:
   - Set `deleted_at` (soft delete)
4. Update device `last_sync_at`
5. Return server timestamp for next sync

**Acceptance:**
- Can push new records
- Can push updated records (last-write-wins)
- Can push deletes (soft delete)
- Rejects records from other users

---

### Task 7: Sync Endpoints — Pull
**PR: `feat/sync-pull`**

Download remote changes to device.

```
POST /api/sync/pull
  Auth: required
  Body: {
    deviceId: string,
    lastSyncedAt: string | null   // null = first sync, pull everything
  }
  Response: {
    syncedAt: string,
    changes: {
      transactions: { upserted: [], deleted: [] },
      categories: { upserted: [], deleted: [] },
      products: { upserted: [], deleted: [] },
      stores: { upserted: [], deleted: [] },
      product_listings: { upserted: [], deleted: [] },
      product_listings_history: { upserted: [], deleted: [] }
    }
  }
```

**Logic:**
1. Query all records where `updated_at > lastSyncedAt` AND `user_id = current user`
2. Separate into upserted (deleted_at IS NULL) and deleted (deleted_at IS NOT NULL)
3. Return changes + new sync timestamp

**First sync (lastSyncedAt = null):**
- Pull ALL user data from server

**Acceptance:**
- First sync pulls everything
- Subsequent syncs pull only changes
- Only returns user's own data
- Deleted records included as deletions

---

## Summary

| Task | PR | Dependencies | Effort |
|------|-----|-------------|--------|
| 1. Project Setup | `feat/project-setup` | None | Small |
| 2. Schema: User/Device | `feat/schema-user-device` | None | Small |
| 3. Schema: Sync Fields | `feat/schema-sync-fields` | Task 2 | Medium |
| 4. Auth Middleware | `feat/auth-middleware` | Task 1 | Small |
| 5. Auth Routes | `feat/auth-routes` | Task 1, 2, 4 | Medium |
| 6. Sync Push | `feat/sync-push` | Task 1, 3, 4 | Large |
| 7. Sync Pull | `feat/sync-pull` | Task 1, 3, 4 | Medium |

**Tasks 1 & 2 can run in parallel.** Everything else is sequential.

**Total estimated effort:** ~2 weeks

---

## What's NOT in Phase 1

- App UUID migration (Phase 1.5 — separate plan for app changes)
- App auth screens
- App sync manager
- Shared wallets
- Payments
- Budgets

---

*Ready to break into PRs? Say the word.* 👻
