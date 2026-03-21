/**
 * Sync protocol types for push/pull operations.
 */

// ─── Table-specific record shapes (what the client sends) ────

export interface TransactionRecord {
	id: string;
	transactionTime: string; // ISO
	amount: string; // Decimal as string
	note?: string | null;
	transactionType: "Income" | "Expense";
	categoryId: string;
	createdAt?: string;
	updatedAt?: string;
}

export interface CategoryRecord {
	id: string;
	name: string;
	icon: string;
	color: string;
	type: "Income" | "Expense";
	createdAt?: string;
	updatedAt?: string;
}

export interface ProductRecord {
	id: string;
	name: string;
	image?: string | null;
	notes?: string | null;
	defaultUnitCategory: string;
	createdAt?: string;
	updatedAt?: string;
}

export interface StoreRecord {
	id: string;
	name: string;
	location?: string | null;
	createdAt?: string;
	updatedAt?: string;
}

export interface ProductListingRecord {
	id: string;
	productId: string;
	name: string;
	storeId: string;
	url?: string | null;
	price: string; // Decimal as string
	quantity: number;
	unit: string;
	createdAt?: string;
	updatedAt?: string;
}

export interface ProductListingHistoryRecord {
	id: string;
	productId: string;
	productListingId: string;
	price: string; // Decimal as string
	recordedAt?: string;
	updatedAt?: string;
}

// ─── Change sets ─────────────────────────────────────────────

export interface ChangeSet<T> {
	upserted: T[];
	deleted: string[]; // IDs of soft-deleted records
}

export interface SyncChanges {
	transactions: ChangeSet<TransactionRecord>;
	categories: ChangeSet<CategoryRecord>;
	products: ChangeSet<ProductRecord>;
	stores: ChangeSet<StoreRecord>;
	productListings: ChangeSet<ProductListingRecord>;
	productListingHistory: ChangeSet<ProductListingHistoryRecord>;
}

// ─── Push/Pull payloads ──────────────────────────────────────

export interface SyncPushRequest {
	deviceId: string;
	lastSyncedAt: string | null;
	changes: SyncChanges;
}

export interface SyncPushResponse {
	syncedAt: string;
	counts: {
		upserted: number;
		deleted: number;
	};
}

export interface SyncPullRequest {
	deviceId: string;
	lastSyncedAt: string | null; // null = first sync, pull everything
}

export interface SyncPullResponse {
	syncedAt: string;
	changes: SyncChanges;
}
