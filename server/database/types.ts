import type { InferSelectModel } from "drizzle-orm";
import type { session, user } from "./user";

export type User = InferSelectModel<typeof user>;
export type Session = InferSelectModel<typeof session>;
