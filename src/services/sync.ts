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

/**
 * Process a sync push — apply all changes from client to server.
 * Strategy: Last-write-wins (upsert by ID).
 */
export async function processSyncPush(
	userId: string,
	deviceId: string,
	changes: SyncChanges,
): Promise<SyncPushResponse> {
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
		await Promise.all(
			changes.categories.upserted.map((record) =>
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
						userId,
						syncVersion: { increment: 1 },
					},
				}),
			),
		);
		totalUpserted += changes.categories.upserted.length;

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
		await Promise.all(
			changes.products.upserted.map((record) =>
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
						userId,
						syncVersion: { increment: 1 },
					},
				}),
			),
		);
		totalUpserted += changes.products.upserted.length;

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
		await Promise.all(
			changes.stores.upserted.map((record) =>
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
						userId,
						syncVersion: { increment: 1 },
					},
				}),
			),
		);
		totalUpserted += changes.stores.upserted.length;

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
		await Promise.all(
			changes.transactions.upserted.map((record) =>
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
						userId,
						syncVersion: { increment: 1 },
					},
				}),
			),
		);
		totalUpserted += changes.transactions.upserted.length;

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
		await Promise.all(
			changes.productListings.upserted.map((record) =>
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
						userId,
						syncVersion: { increment: 1 },
					},
				}),
			),
		);
		totalUpserted += changes.productListings.upserted.length;

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
		await Promise.all(
			changes.productListingHistory.upserted.map((record) =>
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
						userId,
						syncVersion: { increment: 1 },
					},
				}),
			),
		);
		totalUpserted += changes.productListingHistory.upserted.length;

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

	return {
		syncedAt: new Date().toISOString(),
		counts: {
			upserted: totalUpserted,
			deleted: totalDeleted,
		},
	};
}

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
