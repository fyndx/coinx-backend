import { Elysia, t } from "elysia";
import { authPlugin } from "./auth.guard";
import { prisma } from "../../common/services/prisma";
import { Errors, handlePrismaError } from "../../common/errors";
import { useLogger } from "evlog/elysia";

export const authController = new Elysia({ prefix: "/api/auth" })
	/**
	 * POST /api/auth/register
	 * Create or update profile in our DB after Supabase signup.
	 * Idempotent — safe to call multiple times (upsert).
	 */
	.use(authPlugin)
	.post(
		"/register",
		async ({ user, body }) => {
			const log = useLogger();
			log.set({ user: { id: user.id } });
			try {
				const email = user.email ?? body.email;

				// If a profile with this email exists under a different user ID
				// (e.g. user deleted and recreated their Supabase account),
				// update that profile to the new user ID.
				if (email) {
					const existingByEmail = await prisma.profile.findUnique({
						where: { email },
					});

					if (existingByEmail && existingByEmail.id !== user.id) {
						// Transfer profile ownership to new Supabase user ID
						const updated = await prisma.profile.update({
							where: { id: existingByEmail.id },
							data: {
								id: user.id,
								email,
								...(body.displayName && { displayName: body.displayName }),
							},
						});

						return {
							data: {
								id: updated.id,
								email: updated.email,
								displayName: updated.displayName,
								avatarUrl: updated.avatarUrl,
								createdAt: updated.createdAt,
							},
						};
					}
				}

				const profile = await prisma.profile.upsert({
					where: { id: user.id },
					create: {
						id: user.id,
						email,
						displayName: body.displayName,
					},
					update: {
						email,
						...(body.displayName && { displayName: body.displayName }),
					},
				});

				return {
					data: {
						id: profile.id,
						email: profile.email,
						displayName: profile.displayName,
						avatarUrl: profile.avatarUrl,
						createdAt: profile.createdAt,
					},
				};
			} catch (error) {
				throw handlePrismaError(error);
			}
		},
		{
			body: t.Object({
				email: t.Optional(t.String({ format: "email" })),
				displayName: t.Optional(t.String({ minLength: 1, maxLength: 100 })),
			}),
		},
	)

	/**
	 * GET /api/auth/profile
	 * Get current user profile + registered devices.
	 */
	.get("/profile", async ({ user }) => {
		const log = useLogger();
		log.set({ user: { id: user.id } });
		try {
			const profile = await prisma.profile.findUnique({
				where: { id: user.id },
				include: {
					devices: {
						orderBy: { createdAt: "desc" },
					},
				},
			});

			if (!profile) {
				throw Errors.notFound("Profile");
			}

			log.set({ profile: { deviceCount: profile.devices.length } });

			return {
				data: {
					id: profile.id,
					email: profile.email,
					displayName: profile.displayName,
					avatarUrl: profile.avatarUrl,
					createdAt: profile.createdAt,
					devices: profile.devices.map((d) => ({
						id: d.id,
						deviceName: d.deviceName,
						platform: d.platform,
						appVersion: d.appVersion,
						lastSyncAt: d.lastSyncAt,
						createdAt: d.createdAt,
					})),
				},
			};
		} catch (error) {
			if (error instanceof Error && error.name === "AppError") throw error;
			throw handlePrismaError(error);
		}
	})

	/**
	 * POST /api/auth/device
	 * Register a device for sync. Returns deviceId for sync operations.
	 */
	.post(
		"/device",
		async ({ user, body }) => {
			try {
				// Ensure profile exists
				const profile = await prisma.profile.findUnique({
					where: { id: user.id },
				});
				if (!profile) {
					throw Errors.notFound(
						"Profile (call /api/auth/register first)",
					);
				}

				const device = await prisma.device.create({
					data: {
						userId: user.id,
						deviceName: body.deviceName,
						platform: body.platform,
						appVersion: body.appVersion,
					},
				});

				return {
					data: {
						id: device.id,
						deviceName: device.deviceName,
						platform: device.platform,
						appVersion: device.appVersion,
						createdAt: device.createdAt,
					},
				};
			} catch (error) {
				if (error instanceof Error && error.name === "AppError") throw error;
				throw handlePrismaError(error);
			}
		},
		{
			body: t.Object({
				deviceName: t.Optional(t.String({ maxLength: 100 })),
				platform: t.Optional(
					t.Union([t.Literal("ios"), t.Literal("android")]),
				),
				appVersion: t.Optional(t.String({ maxLength: 20 })),
			}),
		},
	)

	/**
	 * DELETE /api/auth/device/:id
	 * Remove a device. Only the device owner can delete it.
	 */
	.delete("/device/:id", async ({ user, params }) => {
		try {
			// Verify the device belongs to this user
			const device = await prisma.device.findUnique({
				where: { id: params.id },
			});

			if (!device) {
				throw Errors.notFound("Device");
			}

			if (device.userId !== user.id) {
				throw Errors.forbidden("Cannot delete another user's device");
			}

			await prisma.device.delete({
				where: { id: params.id },
			});

			return { data: { deleted: true } };
		} catch (error) {
			if (error instanceof Error && error.name === "AppError") throw error;
			throw handlePrismaError(error);
		}
	});
