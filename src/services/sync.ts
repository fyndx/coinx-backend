import { prisma } from "../lib/prisma";
import { Errors } from "../lib/errors";
import type { SyncChanges, SyncPushResponse } from "../types/sync";
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

	// Process all changes in a transaction for atomicity
	await prisma.$transaction(async (tx) => {
		// ─── Transactions ────────────────────────────────────
		for (const record of changes.transactions.upserted) {
			await tx.transaction.upsert({
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
			});
			totalUpserted++;
		}

		for (const id of changes.transactions.deleted) {
			await tx.transaction.updateMany({
				where: { id, userId },
				data: { deletedAt: new Date(), syncVersion: { increment: 1 } },
			});
			totalDeleted++;
		}

		// ─── Categories ──────────────────────────────────────
		for (const record of changes.categories.upserted) {
			await tx.category.upsert({
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
			});
			totalUpserted++;
		}

		for (const id of changes.categories.deleted) {
			await tx.category.updateMany({
				where: { id, userId },
				data: { deletedAt: new Date(), syncVersion: { increment: 1 } },
			});
			totalDeleted++;
		}

		// ─── Products ────────────────────────────────────────
		for (const record of changes.products.upserted) {
			await tx.product.upsert({
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
			});
			totalUpserted++;
		}

		for (const id of changes.products.deleted) {
			await tx.product.updateMany({
				where: { id, userId },
				data: { deletedAt: new Date(), syncVersion: { increment: 1 } },
			});
			totalDeleted++;
		}

		// ─── Stores ──────────────────────────────────────────
		for (const record of changes.stores.upserted) {
			await tx.store.upsert({
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
			});
			totalUpserted++;
		}

		for (const id of changes.stores.deleted) {
			await tx.store.updateMany({
				where: { id, userId },
				data: { deletedAt: new Date(), syncVersion: { increment: 1 } },
			});
			totalDeleted++;
		}

		// ─── Product Listings ────────────────────────────────
		for (const record of changes.productListings.upserted) {
			await tx.productListing.upsert({
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
			});
			totalUpserted++;
		}

		for (const id of changes.productListings.deleted) {
			await tx.productListing.updateMany({
				where: { id, userId },
				data: { deletedAt: new Date(), syncVersion: { increment: 1 } },
			});
			totalDeleted++;
		}

		// ─── Product Listing History ─────────────────────────
		for (const record of changes.productListingHistory.upserted) {
			await tx.productListingHistory.upsert({
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
			});
			totalUpserted++;
		}

		for (const id of changes.productListingHistory.deleted) {
			await tx.productListingHistory.updateMany({
				where: { id, userId },
				data: { deletedAt: new Date(), syncVersion: { increment: 1 } },
			});
			totalDeleted++;
		}

		// Update device last sync time
		await tx.device.update({
			where: { id: deviceId },
			data: { lastSyncAt: new Date() },
		});
	});

	return {
		syncedAt: new Date().toISOString(),
		counts: {
			upserted: totalUpserted,
			deleted: totalDeleted,
		},
	};
}
