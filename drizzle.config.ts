import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: [".env.local", ".env"] });

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  dialect: "postgresql",
  verbose: true,
  strict: true,
  breakpoints: true,
  // ssl comes from the URL (?sslmode=require) so local Postgres works without it
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
