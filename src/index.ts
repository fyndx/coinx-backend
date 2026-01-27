import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { healthRoutes } from "./routes/health";
import { env } from "./lib/env";

const app = new Elysia()
	.use(
		cors({
			origin: true, // Allow all origins during development
			methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
			allowedHeaders: ["Content-Type", "Authorization"],
		}),
	)
	.use(healthRoutes)
	.listen(env.PORT);

console.log(
	`🪙 CoinX Backend running at http://${app.server?.hostname}:${app.server?.port}`,
);

export type App = typeof app;
