import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";
import { env } from "./env";

config({ path: ".env" });

export default defineConfig({
  schema: "./server/database/schema.ts",
  out: "./server/database/migrations",
  dialect: "postgresql",
  verbose: true,
  strict: true,
  breakpoints: true,
  dbCredentials: {
    url: env.DATABASE_URL,
    ssl: "verify-full",
  },
});
