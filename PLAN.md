# CoinX Backend Plan

## Overview

Build a sync backend for CoinX that enables:
1. Cross-device sync (same user, multiple devices)
2. Shared wallets (family members)
3. User authentication

## Architecture Decision

**Option A: Traditional REST API + Polling**
- Simpler to build
- Works offline, sync on app open
- Cons: Not real-time, potential conflicts

**Option B: Real-time Sync (Supabase Realtime / WebSockets)**
- Instant sync across devices
- More complex conflict resolution
- Higher server costs

**Option C: Local-first Sync (PowerSync / ElectricSQL)**
- Best offline experience
- Automatic conflict resolution
- Steeper learning curve

**Recommendation:** Start with Option A (REST + polling), migrate to C later if needed.

---

## Phase 1: Foundation (Week 1-2)

### 1.1 User Authentication
- [ ] Supabase Auth setup
- [ ] Email/password signup
- [ ] Google OAuth (optional, nice to have)
- [ ] JWT token handling in app

### 1.2 Database Schema Updates
- [ ] Add `users` table
- [ ] Add `user_id` foreign key to all tables
- [ ] Add `device_id` for tracking sync source
- [ ] Add `sync_status` enum (pending, synced, conflict)
- [ ] Add `deleted_at` for soft deletes (sync needs this)

### 1.3 ID Migration
- [ ] Switch app from auto-increment to UUID generation
- [ ] Migration path for existing users' data

---

## Phase 2: Core Sync API (Week 2-3)

### 2.1 Sync Endpoints
```
POST /api/sync/push    - Upload local changes
POST /api/sync/pull    - Download remote changes
POST /api/sync/full    - Full sync (initial or recovery)
```

### 2.2 Sync Protocol
- Client tracks `lastSyncedAt` timestamp
- Push: Send all records where `updatedAt > lastSyncedAt`
- Pull: Receive all records where `updatedAt > lastSyncedAt`
- Conflict resolution: Last-write-wins (simple) or manual merge (complex)

### 2.3 Tables to Sync
1. `transactions` - Most important
2. `categories` - User-created categories
3. `products` - Product catalog
4. `stores` - Store list
5. `product_listings` - Products at stores
6. `product_listings_history` - Price history

---

## Phase 3: App Integration (Week 3-4)

### 3.1 Auth Flow in App
- [ ] Login/signup screens
- [ ] Token storage (secure)
- [ ] Auto-refresh tokens
- [ ] Logout flow

### 3.2 Sync Manager
- [ ] Background sync on app open
- [ ] Manual sync button
- [ ] Sync status indicator
- [ ] Offline queue for changes
- [ ] Conflict UI (if needed)

### 3.3 Settings
- [ ] Account management
- [ ] Sync preferences
- [ ] Data export

---

## Phase 4: Shared Wallets (Week 5-6)

### 4.1 Sharing Model
- [ ] `wallets` table (group of users)
- [ ] `wallet_members` table (user + role)
- [ ] Invite system (email or link)
- [ ] Permissions (owner, editor, viewer)

### 4.2 Data Isolation
- [ ] Personal data vs shared data
- [ ] Filter queries by wallet context
- [ ] UI for switching wallets

---

## Phase 5: Monetization (Week 6+)

### 5.1 Subscription Tiers
- **Free:** Local only (current)
- **Pro (₹99/mo or ₹799/yr):** Sync + 1 shared wallet
- **Family (₹199/mo or ₹1499/yr):** Sync + 5 shared wallets

### 5.2 Payment Integration
- [ ] RevenueCat or Stripe
- [ ] In-app purchase (iOS/Android)
- [ ] Subscription management
- [ ] Grace period for expired subs

---

## Tech Stack

- **Backend:** Hono.js (fast, TypeScript, edge-ready)
- **Database:** Supabase (Postgres)
- **Auth:** Supabase Auth
- **Hosting:** Supabase Edge Functions or Cloudflare Workers
- **Payments:** RevenueCat (handles both app stores)

---

## Decisions Made (2026-01-26)

1. **Conflict resolution:** Last-write-wins ✅
2. **Sync frequency:** Background sync ✅
3. **Pricing:** ₹99/month for beta/launch ✅
4. **Migration:** TBD - need to design
5. **Budgets:** Phase 2 ✅

---

## Next Steps

1. Validate with users: Would they pay for sync?
2. Decide on conflict resolution strategy
3. Start with auth + basic sync endpoints
4. Ship MVP to 10 beta users
5. Iterate based on feedback

---

*Let's discuss each phase before coding. What questions do you have?*
