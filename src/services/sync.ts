import { prisma } from "../lib/prisma";
import { Errors } from "../lib/errors";
import type {
	SyncChanges,
	SyncPushResponse,
	SyncPullResponse,
	TransactionRecord,
	CategoryRecord,
	ProductRecord,
	StoreRecord,
	ProductListingRecord,
	ProductListingHistoryRecord,
} from "../types/sync";
import { Prisma } from "../../generated/prisma/client.js";
import { useLogger } from "evlog/elysia";
import { logger } from "./logger";

// ─── Ownership helper ─────────────────────────────────────────

/**
 * Given incoming records and a lookup function, return only the IDs that are
 * safe to upsert:
 *   - IDs that don't exist yet (will be created owned by this user), OR
 *   - IDs that already exist AND belong to this user (safe to update)
 *
 * IDs owned by a different user are silently dropped to prevent
 * ownership hijacking (even though UUID collisions are astronomically unlikely,
 * a malicious client could intentionally target a known record ID).
 */
async function filterSafeRecords<T extends { id: string }>(
	records: T[],
	findConflicts: (ids: string[]) => Promise<{ id: string }[]>,
	tableName?: string,
): Promise<T[]> {
	if (records.length === 0) return [];

	const ids = records.map((r) => r.id);
	const conflicting = await findConflicts(ids);

	if (conflicting.length === 0) return records;

	const blockedIds = new Set(conflicting.map((r) => r.id));
	const filtered = records.filter((r) => !blockedIds.has(r.id));
	
	if (conflicting.length > 0) {
		// Enrich the request-scoped wide event with conflict details
		useLogger().set({
			ownershipConflicts: {
				table: tableName,
				blockedCount: conflicting.length,
				blockedIds: Array.from(blockedIds),
			},
		});
	}
	
	return filtered;
}

// ─── Push ─────────────────────────────────────────────────────

/**
 * Process a sync push — apply all changes from client to server.
 * Strategy: Last-write-wins (upsert by ID).
 *
 * Security guarantees:
 *   1. userId always comes from the verified JWT — the client cannot supply it.
 *   2. Device ownership is verified before any writes.
 *   3. Records already owned by a *different* user are silently skipped,
 *      preventing ownership hijacking via crafted IDs.
 *   4. Foreign keys (categoryId, productId, storeId, productListingId) are
 *      validated to belong to the current user before writing.
 *   5. Soft-deletes use updateMany({ where: { id, userId } }), so a user
 *      can only soft-delete their own records.
 *   6. userId is never included in the `update` block of an upsert — an
 *      existing record's ownership cannot change.
 */
export async function processSyncPush(
	userId: string,
	deviceId: string,
	changes: SyncChanges,
): Promise<SyncPushResponse> {
	// Log incoming sync push request
	logger.info(
		{
			userId,
			deviceId,
			changeCounts: {
				transactions: {
					upserted: changes.transactions.upserted.length,
					deleted: changes.transactions.deleted.length,
				},
				categories: {
					upserted: changes.categories.upserted.length,
					deleted: changes.categories.deleted.length,
				},
				products: {
					upserted: changes.products.upserted.length,
					deleted: changes.products.deleted.length,
				},
				stores: {
					upserted: changes.stores.upserted.length,
					deleted: changes.stores.deleted.length,
				},
				productListings: {
					upserted: changes.productListings.upserted.length,
					deleted: changes.productListings.deleted.length,
				},
				productListingHistory: {
					upserted: changes.productListingHistory.upserted.length,
					deleted: changes.productListingHistory.deleted.length,
				},
			},
		},
		"Processing sync push",
	);

	// Verify device belongs to user
	const device = await prisma.device.findUnique({
		where: { id: deviceId },
	});

	if (!device || device.userId !== userId) {
		throw Errors.forbidden("Device does not belong to this user");
	}

	let totalUpserted = 0;
	let totalDeleted = 0;

	// Process all changes in a transaction for atomicity.
	// Order matters! Parent tables (categories, stores, products) must be
	// inserted before child tables (transactions, product_listings, product_listing_history).
	// Within each table group, upserts run in parallel for speed.
	await prisma.$transaction(async (tx) => {
		// ─── Categories (parent — referenced by transactions) ─
		const safeCategories = await filterSafeRecords(
			changes.categories.upserted,
			(ids) =>
				tx.category.findMany({
					where: { id: { in: ids }, NOT: { userId } },
					select: { id: true },
				}),
			"categories",
		);

		await Promise.all(
			safeCategories.map((record) =>
				tx.category.upsert({
					where: { id: record.id },
					create: {
						id: record.id,
						name: record.name,
						icon: record.icon,
						color: record.color,
						type: record.type,
						userId,
						syncVersion: 1,
					},
					update: {
						name: record.name,
						icon: record.icon,
						color: record.color,
						type: record.type,
						// userId intentionally omitted — never transfer ownership on update
						syncVersion: { increment: 1 },
					},
				}),
			),
		);
		totalUpserted += safeCategories.length;

		await Promise.all(
			changes.categories.deleted.map((id) =>
				tx.category.updateMany({
					where: { id, userId },
					data: { deletedAt: new Date(), syncVersion: { increment: 1 } },
				}),
			),
		);
		totalDeleted += changes.categories.deleted.length;

		// ─── Products ────────────────────────────────────────
		const safeProducts = await filterSafeRecords(
			changes.products.upserted,
			(ids) =>
				tx.product.findMany({
					where: { id: { in: ids }, NOT: { userId } },
					select: { id: true },
				}),
			"products",
		);

		await Promise.all(
			safeProducts.map((record) =>
				tx.product.upsert({
					where: { id: record.id },
					create: {
						id: record.id,
						name: record.name,
						image: record.image,
						notes: record.notes,
						defaultUnitCategory: record.defaultUnitCategory,
						userId,
						syncVersion: 1,
					},
					update: {
						name: record.name,
						image: record.image,
						notes: record.notes,
						defaultUnitCategory: record.defaultUnitCategory,
						// userId intentionally omitted
						syncVersion: { increment: 1 },
					},
				}),
			),
		);
		totalUpserted += safeProducts.length;

		await Promise.all(
			changes.products.deleted.map((id) =>
				tx.product.updateMany({
					where: { id, userId },
					data: { deletedAt: new Date(), syncVersion: { increment: 1 } },
				}),
			),
		);
		totalDeleted += changes.products.deleted.length;

		// ─── Stores ──────────────────────────────────────────
		const safeStores = await filterSafeRecords(
			changes.stores.upserted,
			(ids) =>
				tx.store.findMany({
					where: { id: { in: ids }, NOT: { userId } },
					select: { id: true },
				}),
			"stores",
		);

		await Promise.all(
			safeStores.map((record) =>
				tx.store.upsert({
					where: { id: record.id },
					create: {
						id: record.id,
						name: record.name,
						location: record.location,
						userId,
						syncVersion: 1,
					},
					update: {
						name: record.name,
						location: record.location,
						// userId intentionally omitted
						syncVersion: { increment: 1 },
					},
				}),
			),
		);
		totalUpserted += safeStores.length;

		await Promise.all(
			changes.stores.deleted.map((id) =>
				tx.store.updateMany({
					where: { id, userId },
					data: { deletedAt: new Date(), syncVersion: { increment: 1 } },
				}),
			),
		);
		totalDeleted += changes.stores.deleted.length;

		// ─── Transactions (child — references categories) ───
		// Step 1: Filter out transactions with IDs owned by another user
		const idSafeTransactions = await filterSafeRecords(
			changes.transactions.upserted,
			(ids) =>
				tx.transaction.findMany({
					where: { id: { in: ids }, NOT: { userId } },
					select: { id: true },
				}),
			"transactions",
		);

		// Step 2: Validate categoryId ownership — reject any transaction
		// referencing a category that doesn't belong to this user.
		const categoryIds = [
			...new Set(
				idSafeTransactions
					.map((t) => t.categoryId)
					.filter(Boolean) as string[],
			),
		];
		const validCategories =
			categoryIds.length > 0
				? await tx.category.findMany({
						where: { id: { in: categoryIds }, userId, deletedAt: null },
						select: { id: true },
					})
				: [];
		const validCategorySet = new Set(validCategories.map((c) => c.id));
		const safeTransactions = idSafeTransactions.filter(
			(t) => !t.categoryId || validCategorySet.has(t.categoryId),
		);
		
		// Log transactions filtered out due to invalid categoryId
		const filteredByCategory = idSafeTransactions.length - safeTransactions.length;
		if (filteredByCategory > 0) {
			const invalidCategoryIds = idSafeTransactions
				.filter((t) => t.categoryId && !validCategorySet.has(t.categoryId))
				.map((t) => ({ transactionId: t.id, categoryId: t.categoryId }));
			logger.warn(
				{
					filteredCount: filteredByCategory,
					invalidReferences: invalidCategoryIds,
					validCategories: Array.from(validCategorySet),
				},
				"Transactions filtered due to invalid categoryId references",
			);
		}

		await Promise.all(
			safeTransactions.map((record) =>
				tx.transaction.upsert({
					where: { id: record.id },
					create: {
						id: record.id,
						transactionTime: new Date(record.transactionTime),
						amount: new Prisma.Decimal(record.amount),
						note: record.note,
						transactionType: record.transactionType,
						categoryId: record.categoryId,
						userId,
						syncVersion: 1,
					},
					update: {
						transactionTime: new Date(record.transactionTime),
						amount: new Prisma.Decimal(record.amount),
						note: record.note,
						transactionType: record.transactionType,
						categoryId: record.categoryId,
						// userId intentionally omitted
						syncVersion: { increment: 1 },
					},
				}),
			),
		);
		totalUpserted += safeTransactions.length;

		await Promise.all(
			changes.transactions.deleted.map((id) =>
				tx.transaction.updateMany({
					where: { id, userId },
					data: { deletedAt: new Date(), syncVersion: { increment: 1 } },
				}),
			),
		);
		totalDeleted += changes.transactions.deleted.length;

		// ─── Product Listings (child — references products, stores) ─
		// Step 1: Filter out listings with IDs owned by another user
		const idSafeProductListings = await filterSafeRecords(
			changes.productListings.upserted,
			(ids) =>
				tx.productListing.findMany({
					where: { id: { in: ids }, NOT: { userId } },
					select: { id: true },
				}),
			"product_listings",
		);

		// Step 2: Validate productId and storeId ownership — reject any listing
		// referencing a product or store that doesn't belong to this user.
		const productIdsForListings = [
			...new Set(
				idSafeProductListings
					.map((pl) => pl.productId)
					.filter(Boolean) as string[],
			),
		];
		const storeIdsForListings = [
			...new Set(
				idSafeProductListings
					.map((pl) => pl.storeId)
					.filter(Boolean) as string[],
			),
		];
		const [validProductsForListings, validStoresForListings] =
			await Promise.all([
				productIdsForListings.length > 0
					? tx.product.findMany({
							where: {
								id: { in: productIdsForListings },
								userId,
								deletedAt: null,
							},
							select: { id: true },
						})
					: [],
				storeIdsForListings.length > 0
					? tx.store.findMany({
							where: {
								id: { in: storeIdsForListings },
								userId,
								deletedAt: null,
							},
							select: { id: true },
						})
					: [],
			]);
		const validProductSetForListings = new Set(
			validProductsForListings.map((p) => p.id),
		);
		const validStoreSetForListings = new Set(
			validStoresForListings.map((s) => s.id),
		);
		const safeProductListings = idSafeProductListings.filter(
			(pl) =>
				(!pl.productId || validProductSetForListings.has(pl.productId)) &&
				(!pl.storeId || validStoreSetForListings.has(pl.storeId)),
		);
		
		// Log product listings filtered out due to invalid foreign keys
		const filteredListings = idSafeProductListings.length - safeProductListings.length;
		if (filteredListings > 0) {
			logger.warn(
				{ filteredCount: filteredListings },
				"Product listings filtered due to invalid productId or storeId references",
			);
		}

		await Promise.all(
			safeProductListings.map((record) =>
				tx.productListing.upsert({
					where: { id: record.id },
					create: {
						id: record.id,
						productId: record.productId,
						name: record.name,
						storeId: record.storeId,
						url: record.url,
						price: new Prisma.Decimal(record.price),
						quantity: record.quantity,
						unit: record.unit,
						userId,
						syncVersion: 1,
					},
					update: {
						productId: record.productId,
						name: record.name,
						storeId: record.storeId,
						url: record.url,
						price: new Prisma.Decimal(record.price),
						quantity: record.quantity,
						unit: record.unit,
						// userId intentionally omitted
						syncVersion: { increment: 1 },
					},
				}),
			),
		);
		totalUpserted += safeProductListings.length;

		await Promise.all(
			changes.productListings.deleted.map((id) =>
				tx.productListing.updateMany({
					where: { id, userId },
					data: { deletedAt: new Date(), syncVersion: { increment: 1 } },
				}),
			),
		);
		totalDeleted += changes.productListings.deleted.length;

		// ─── Product Listing History ─────────────────────────
		// Step 1: Filter out history records with IDs owned by another user
		const idSafeProductListingHistory = await filterSafeRecords(
			changes.productListingHistory.upserted,
			(ids) =>
				tx.productListingHistory.findMany({
					where: { id: { in: ids }, NOT: { userId } },
					select: { id: true },
				}),
			"product_listing_history",
		);

		// Step 2: Validate productId and productListingId ownership — reject any
		// history record referencing a product or listing not owned by this user.
		const productIdsForHistory = [
			...new Set(
				idSafeProductListingHistory
					.map((plh) => plh.productId)
					.filter(Boolean) as string[],
			),
		];
		const productListingIdsForHistory = [
			...new Set(
				idSafeProductListingHistory
					.map((plh) => plh.productListingId)
					.filter(Boolean) as string[],
			),
		];
		const [validProductsForHistory, validProductListingsForHistory] =
			await Promise.all([
				productIdsForHistory.length > 0
					? tx.product.findMany({
							where: {
								id: { in: productIdsForHistory },
								userId,
								deletedAt: null,
							},
							select: { id: true },
						})
					: [],
				productListingIdsForHistory.length > 0
					? tx.productListing.findMany({
							where: {
								id: { in: productListingIdsForHistory },
								userId,
								deletedAt: null,
							},
							select: { id: true },
						})
					: [],
			]);
		const validProductSetForHistory = new Set(
			validProductsForHistory.map((p) => p.id),
		);
		const validProductListingSetForHistory = new Set(
			validProductListingsForHistory.map((pl) => pl.id),
		);
		const safeProductListingHistory =
			idSafeProductListingHistory.filter(
				(plh) =>
					(!plh.productId || validProductSetForHistory.has(plh.productId)) &&
					(!plh.productListingId ||
						validProductListingSetForHistory.has(plh.productListingId)),
			);
		
		// Log history records filtered out due to invalid foreign keys
		const filteredHistory = idSafeProductListingHistory.length - safeProductListingHistory.length;
		if (filteredHistory > 0) {
			logger.warn(
				{ filteredCount: filteredHistory },
				"Product listing history filtered due to invalid foreign key references",
			);
		}

		await Promise.all(
			safeProductListingHistory.map((record) =>
				tx.productListingHistory.upsert({
					where: { id: record.id },
					create: {
						id: record.id,
						productId: record.productId,
						productListingId: record.productListingId,
						price: new Prisma.Decimal(record.price),
						recordedAt: record.recordedAt
							? new Date(record.recordedAt)
							: new Date(),
						userId,
						syncVersion: 1,
					},
					update: {
						productId: record.productId,
						productListingId: record.productListingId,
						price: new Prisma.Decimal(record.price),
						// userId intentionally omitted
						syncVersion: { increment: 1 },
					},
				}),
			),
		);
		totalUpserted += safeProductListingHistory.length;

		await Promise.all(
			changes.productListingHistory.deleted.map((id) =>
				tx.productListingHistory.updateMany({
					where: { id, userId },
					data: { deletedAt: new Date(), syncVersion: { increment: 1 } },
				}),
			),
		);
		totalDeleted += changes.productListingHistory.deleted.length;

		// Update device last sync time
		await tx.device.update({
			where: { id: deviceId },
			data: { lastSyncAt: new Date() },
		});
	}, { timeout: 30000 });

	const result = {
		syncedAt: new Date().toISOString(),
		counts: {
			upserted: totalUpserted,
			deleted: totalDeleted,
		},
	};

	logger.info(
		{
			userId,
			deviceId,
			result,
		},
		"Sync push completed",
	);

	return result;
}

// ─── Pull ─────────────────────────────────────────────────────

/**
 * Process a sync pull — return all changes since lastSyncedAt.
 * If lastSyncedAt is null, return everything (first sync).
 */
export async function processSyncPull(
	userId: string,
	deviceId: string,
	lastSyncedAt: string | null,
): Promise<SyncPullResponse> {
	// Verify device belongs to user
	const device = await prisma.device.findUnique({
		where: { id: deviceId },
	});

	if (!device || device.userId !== userId) {
		throw Errors.forbidden("Device does not belong to this user");
	}

	const since = lastSyncedAt ? new Date(lastSyncedAt) : null;

	// Build the where clause: user's records, updated after lastSyncedAt
	const baseWhere = (extra?: Record<string, unknown>) => ({
		userId,
		...(since && { updatedAt: { gt: since } }),
		...extra,
	});

	// ─── Fetch all tables in parallel ────────────────────────
	const [
		transactions,
		deletedTransactions,
		categories,
		deletedCategories,
		products,
		deletedProducts,
		stores,
		deletedStores,
		productListings,
		deletedProductListings,
		productListingHistory,
		deletedProductListingHistory,
	] = await Promise.all([
		// Active records
		prisma.transaction.findMany({
			where: baseWhere({ deletedAt: null }),
		}),
		prisma.transaction.findMany({
			where: baseWhere({ deletedAt: { not: null } }),
			select: { id: true },
		}),

		prisma.category.findMany({
			where: baseWhere({ deletedAt: null }),
		}),
		prisma.category.findMany({
			where: baseWhere({ deletedAt: { not: null } }),
			select: { id: true },
		}),

		prisma.product.findMany({
			where: baseWhere({ deletedAt: null }),
		}),
		prisma.product.findMany({
			where: baseWhere({ deletedAt: { not: null } }),
			select: { id: true },
		}),

		prisma.store.findMany({
			where: baseWhere({ deletedAt: null }),
		}),
		prisma.store.findMany({
			where: baseWhere({ deletedAt: { not: null } }),
			select: { id: true },
		}),

		prisma.productListing.findMany({
			where: baseWhere({ deletedAt: null }),
		}),
		prisma.productListing.findMany({
			where: baseWhere({ deletedAt: { not: null } }),
			select: { id: true },
		}),

		prisma.productListingHistory.findMany({
			where: baseWhere({ deletedAt: null }),
		}),
		prisma.productListingHistory.findMany({
			where: baseWhere({ deletedAt: { not: null } }),
			select: { id: true },
		}),
	]);

	// Update device last sync time
	await prisma.device.update({
		where: { id: deviceId },
		data: { lastSyncAt: new Date() },
	});

	const syncedAt = new Date().toISOString();

	return {
		syncedAt,
		changes: {
			transactions: {
				upserted: transactions.map(
					(t): TransactionRecord => ({
						id: t.id,
						transactionTime: t.transactionTime.toISOString(),
						amount: t.amount.toString(),
						note: t.note,
						transactionType: t.transactionType,
						categoryId: t.categoryId,
						createdAt: t.createdAt.toISOString(),
						updatedAt: t.updatedAt?.toISOString(),
					}),
				),
				deleted: deletedTransactions.map((t) => t.id),
			},
			categories: {
				upserted: categories.map(
					(c): CategoryRecord => ({
						id: c.id,
						name: c.name,
						icon: c.icon,
						color: c.color,
						type: c.type,
						createdAt: c.createdAt.toISOString(),
						updatedAt: c.updatedAt?.toISOString(),
					}),
				),
				deleted: deletedCategories.map((c) => c.id),
			},
			products: {
				upserted: products.map(
					(p): ProductRecord => ({
						id: p.id,
						name: p.name,
						image: p.image,
						notes: p.notes,
						defaultUnitCategory: p.defaultUnitCategory,
						createdAt: p.createdAt.toISOString(),
						updatedAt: p.updatedAt?.toISOString(),
					}),
				),
				deleted: deletedProducts.map((p) => p.id),
			},
			stores: {
				upserted: stores.map(
					(s): StoreRecord => ({
						id: s.id,
						name: s.name,
						location: s.location,
						createdAt: s.createdAt.toISOString(),
						updatedAt: s.updatedAt?.toISOString(),
					}),
				),
				deleted: deletedStores.map((s) => s.id),
			},
			productListings: {
				upserted: productListings.map(
					(pl): ProductListingRecord => ({
						id: pl.id,
						productId: pl.productId,
						name: pl.name,
						storeId: pl.storeId,
						url: pl.url,
						price: pl.price.toString(),
						quantity: pl.quantity,
						unit: pl.unit,
						createdAt: pl.createdAt.toISOString(),
						updatedAt: pl.updatedAt?.toISOString(),
					}),
				),
				deleted: deletedProductListings.map((pl) => pl.id),
			},
			productListingHistory: {
				upserted: productListingHistory.map(
					(plh): ProductListingHistoryRecord => ({
						id: plh.id,
						productId: plh.productId,
						productListingId: plh.productListingId,
						price: plh.price.toString(),
						recordedAt: plh.recordedAt.toISOString(),
						updatedAt: plh.updatedAt?.toISOString(),
					}),
				),
				deleted: deletedProductListingHistory.map((plh) => plh.id),
			},
		},
	};
}
