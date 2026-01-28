import { Elysia, t } from "elysia";
import { authPlugin } from "../middleware/auth";
import { processSyncPush, processSyncPull } from "../services/sync";
import { handlePrismaError } from "../lib/errors";

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

export const syncRoutes = new Elysia({ prefix: "/api/sync" })
	.use(authPlugin)

	/**
	 * POST /api/sync/push
	 * Upload local changes to server.
	 * Strategy: Last-write-wins (upsert by ID).
	 */
	.post(
		"/push",
		async ({ user, body }) => {
			try {
				const result = await processSyncPush(
					user.id,
					body.deviceId,
					body.changes,
				);
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
			try {
				const result = await processSyncPull(
					user.id,
					body.deviceId,
					body.lastSyncedAt,
				);
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
