import { Elysia, t } from "elysia";
import { authPlugin } from "../auth/auth.guard";
import { processSyncPush, processSyncPull } from "./sync.service";
import { handlePrismaError } from "../../common/errors";
import type { SyncPullResponse } from "./sync.model";
import { useLogger } from "evlog/elysia";

// Sums total records returned in a pull response for logging
function countSyncRecords(result: SyncPullResponse): number {
	return Object.values(result.changes).reduce(
		(sum, changeSet) => sum + changeSet.upserted.length + changeSet.deleted.length,
		0,
	);
}

// ─── Validation schemas ──────────────────────────────────────

const TransactionSchema = t.Object({
	id: t.String(),
	transactionTime: t.String(),
	amount: t.String(),
	note: t.Optional(t.Union([t.String(), t.Null()])),
	transactionType: t.Union([t.Literal("Income"), t.Literal("Expense")]),
	categoryId: t.String(),
	createdAt: t.Optional(t.String()),
	updatedAt: t.Optional(t.String()),
});

const CategorySchema = t.Object({
	id: t.String(),
	name: t.String(),
	icon: t.String(),
	color: t.String(),
	type: t.Union([t.Literal("Income"), t.Literal("Expense")]),
	createdAt: t.Optional(t.String()),
	updatedAt: t.Optional(t.String()),
});

const ProductSchema = t.Object({
	id: t.String(),
	name: t.String(),
	image: t.Optional(t.Union([t.String(), t.Null()])),
	notes: t.Optional(t.Union([t.String(), t.Null()])),
	defaultUnitCategory: t.String(),
	createdAt: t.Optional(t.String()),
	updatedAt: t.Optional(t.String()),
});

const StoreSchema = t.Object({
	id: t.String(),
	name: t.String(),
	location: t.Optional(t.Union([t.String(), t.Null()])),
	createdAt: t.Optional(t.String()),
	updatedAt: t.Optional(t.String()),
});

const ProductListingSchema = t.Object({
	id: t.String(),
	productId: t.String(),
	name: t.String(),
	storeId: t.String(),
	url: t.Optional(t.Union([t.String(), t.Null()])),
	price: t.String(),
	quantity: t.Number(),
	unit: t.String(),
	createdAt: t.Optional(t.String()),
	updatedAt: t.Optional(t.String()),
});

const ProductListingHistorySchema = t.Object({
	id: t.String(),
	productId: t.String(),
	productListingId: t.String(),
	price: t.String(),
	recordedAt: t.Optional(t.String()),
	updatedAt: t.Optional(t.String()),
});

const ChangeSetSchema = <T extends ReturnType<typeof t.Object>>(schema: T) =>
	t.Object({
		upserted: t.Array(schema),
		deleted: t.Array(t.String()),
	});

// ─── Routes ──────────────────────────────────────────────────

export const syncController = new Elysia({ prefix: "/api/sync" })
	.use(authPlugin)

	/**
	 * POST /api/sync/push
	 * Upload local changes to server.
	 * Strategy: Last-write-wins (upsert by ID).
	 */
	.post(
		"/push",
		async ({ user, body }) => {
			const log = useLogger();
			// Build a compact summary of what's being pushed
			const changeSummary = Object.fromEntries(
				Object.entries(body.changes).map(([key, val]) => [
					key,
					{ upserted: val.upserted.length, deleted: val.deleted.length },
				]),
			);
			log.set({ sync: { deviceId: body.deviceId, changes: changeSummary } });
			try {
				const result = await processSyncPush(
					user.id,
					body.deviceId,
					body.changes,
				);
				log.set({ sync: { result } });
				return { data: result };
			} catch (error) {
				if (error instanceof Error && error.name === "AppError") throw error;
				throw handlePrismaError(error);
			}
		},
		{
			body: t.Object({
				deviceId: t.String(),
				lastSyncedAt: t.Union([t.String(), t.Null()]),
				changes: t.Object({
					transactions: ChangeSetSchema(TransactionSchema),
					categories: ChangeSetSchema(CategorySchema),
					products: ChangeSetSchema(ProductSchema),
					stores: ChangeSetSchema(StoreSchema),
					productListings: ChangeSetSchema(ProductListingSchema),
					productListingHistory: ChangeSetSchema(
						ProductListingHistorySchema,
					),
				}),
			}),
		},
	)

	/**
	 * POST /api/sync/pull
	 * Download remote changes since lastSyncedAt.
	 * If lastSyncedAt is null, returns all user data (first sync).
	 */
	.post(
		"/pull",
		async ({ user, body }) => {
			const log = useLogger();
			log.set({
				sync: {
					deviceId: body.deviceId,
					lastSyncedAt: body.lastSyncedAt,
					isFirstSync: body.lastSyncedAt === null,
				},
			});
			try {
				const result = await processSyncPull(
					user.id,
					body.deviceId,
					body.lastSyncedAt,
				);
				log.set({ sync: { recordCount: countSyncRecords(result) } });
				return { data: result };
			} catch (error) {
				if (error instanceof Error && error.name === "AppError") throw error;
				throw handlePrismaError(error);
			}
		},
		{
			body: t.Object({
				deviceId: t.String(),
				lastSyncedAt: t.Union([t.String(), t.Null()]),
			}),
		},
	);
