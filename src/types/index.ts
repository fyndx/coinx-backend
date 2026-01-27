// Shared types for CoinX Backend

export interface AuthUser {
	id: string;
	email?: string;
}

export interface SyncMeta {
	deviceId: string;
	lastSyncedAt: string | null;
}
