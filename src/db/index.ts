import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { requireEnv } from "#/lib/env";
import { relations } from "./relations";
import * as schema from "./schema";

const queryClient = postgres(requireEnv("DATABASE_URL"), { prepare: false });
const db = drizzle({ client: queryClient, relations });

export { db, queryClient as driver, schema as tables };
