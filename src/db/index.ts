import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { requireEnv } from "#/lib/env";
import { relations } from "./relations";
import * as schema from "./schema";

// Serverless instances share Supabase's pooler: keep few connections, close idle ones
// before the pooler drops them, and fail fast instead of hanging on a dead connect.
const queryClient = postgres(requireEnv("DATABASE_URL"), {
	prepare: false,
	max: 3,
	idle_timeout: 20,
	connect_timeout: 10,
});
const db = drizzle({ client: queryClient, relations });

export { db, queryClient as driver, schema as tables };
