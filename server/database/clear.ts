import fs from "node:fs";
import path from "node:path";
import { sql } from "drizzle-orm";
import { db, driver as pool } from "./db";
import "dotenv/config";

async function main() {
  if (!db.query || Object.keys(db.query).length === 0) {
    throw new Error("Schema not loaded");
  }

  // Get current database role
  const result = await db.execute(sql.raw("SELECT current_user;"));
  const currentRole = (result[0] as { current_user: string }).current_user;
  console.log(`🔑 Current database role: ${currentRole}`);

  // Drop drizzle schema (if it exists)
  await db.execute(sql.raw(`DROP SCHEMA IF EXISTS "drizzle" CASCADE;`));

  // Drop and recreate public schema
  await db.execute(sql.raw(`DROP SCHEMA IF EXISTS public CASCADE;`));
  await db.execute(sql.raw(`CREATE SCHEMA public;`));

  // Grant privileges to current role
  // NOTE: each statement is run separately — postgres.js prepared statements
  // cannot contain multiple semicolon-separated commands in a single query.
  await db.execute(sql.raw(`GRANT USAGE ON SCHEMA public TO "${currentRole}";`));
  await db.execute(
    sql.raw(`GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO "${currentRole}";`),
  );
  await db.execute(
    sql.raw(`GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO "${currentRole}";`),
  );
  await db.execute(
    sql.raw(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO "${currentRole}";`),
  );
  await db.execute(
    sql.raw(
      `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO "${currentRole}";`,
    ),
  );

  const migrationsDir = path.join(process.cwd(), "server", "database", "migrations");
  console.log("migrationsDir", migrationsDir);

  if (fs.existsSync(migrationsDir)) {
    for (const entry of fs.readdirSync(migrationsDir)) {
      fs.rmSync(path.join(migrationsDir, entry), {
        recursive: true,
        force: true,
      });
    }
    console.log(`🗑️  Cleared all contents inside: ${migrationsDir}`);
  } else {
    console.log(`⚠️  No migrations directory found at: ${migrationsDir}`);
  }

  console.log("✅ Database schemas dropped and migrations folder cleared");
}

main()
  .catch((err) => {
    console.error("❌ Error clearing database and migrations folder:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
