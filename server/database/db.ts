import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { env } from "../../env";
import { relations } from "./relations";

const tables = schema;

const connectionString = env.DATABASE_URL;

const queryClient = postgres(connectionString, { prepare: false });

const db = drizzle({ client: queryClient, relations });

export { db, queryClient as driver, tables };
