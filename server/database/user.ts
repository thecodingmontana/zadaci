import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { timestamps } from "./utils";

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  username: varchar("username", { length: 255 }).notNull(),
  password: text("password"),
  email_verified: boolean("email_verified").notNull().default(false),
  registered_2fa: boolean("registered_2fa").notNull().default(false),
  recovery_code: text("recovery_code").notNull(),
  profile_picture_url: text("profile_picture_url"),
  ...timestamps,
});

export const unique_code = pgTable("unique_code_request", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  code: text("code").notNull(),
  expires_at: timestamp("expires_at", {
    withTimezone: true,
    mode: "date",
  }).notNull(),
  ...timestamps,
});

export const session = pgTable("session", {
  id: varchar("id", { length: 255 }).primaryKey(),
  user_id: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  expires_at: timestamp("expires_at", {
    withTimezone: true,
    mode: "date",
  }).notNull(),
  two_factor_verified: boolean("two_factor_verified").notNull().default(false),
  ip_address: varchar("ip_address", { length: 100 }),
  location: text("location"),
  device: text("device"),
  browser: text("browser"),
  os: text("os"),
  ...timestamps,
});

export const password_reset_session = pgTable("password_reset_session", {
  id: varchar("id", { length: 255 }).primaryKey(),
  user_id: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  email: varchar("email", { length: 255 }).notNull(),
  code: varchar("code", { length: 255 }).notNull(),
  expires_at: integer("expires_at").notNull(),
  email_verified: boolean("email_verified").notNull().default(false),
  two_factor_verified: boolean("two_factor_verified").notNull().default(false),
  ...timestamps,
});

export const totp_credential = pgTable("totp_credential", {
  id: varchar("id", { length: 255 }).primaryKey(),
  user_id: text("user_id")
    .notNull()
    .unique()
    .references(() => user.id, { onDelete: "cascade" }),
  key: text("key").notNull(),
  ...timestamps,
});

export const passkeys = pgTable("passkeys", {
  id: text("id").primaryKey(),
  user_id: text("user_id")
    .notNull()
    .references(() => user.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
  public_key: text("public_key").notNull(),
  counter: integer("counter").notNull(),
  backed_up: boolean("backed_up").notNull().default(false),
  transports: text("transports").notNull(),
  ...timestamps,
});

export const oauth_account = pgTable(
  "oauth_account",
  {
    id: text("id").primaryKey(),
    user_id: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    provider_user_id: text("provider_user_id").notNull(),
    ...timestamps,
  },
  (table) => ({
    providerUserIndex: index("provider_user_unique").on(
      table.provider,
      table.provider_user_id,
    ),
  }),
);
