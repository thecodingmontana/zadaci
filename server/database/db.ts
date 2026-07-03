import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "../../env";
import { relations } from "./relations";
import * as schema from "./schema";

const tables = schema;

const connectionString = env.DATABASE_URL;

const queryClient = postgres(connectionString, { prepare: false });

const db = drizzle({ client: queryClient, relations });

export { db, queryClient as driver, tables };
