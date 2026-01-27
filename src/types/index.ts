// Shared types for CoinX Backend
// AuthUser is defined in src/middleware/auth.ts
export type { AuthUser } from "../middleware/auth";

export interface SyncMeta {
	deviceId: string;
	lastSyncedAt: string | null;
}
