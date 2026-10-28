import { waitUntil } from "@vercel/functions";
import { eq } from "drizzle-orm";
import { type DocumentNode, getOperationAST, Kind } from "graphql";
import { db, tables } from "#/db";

// Live updates: after anything changes in a workspace, everyone who has it open is told "something
// changed" over Supabase Realtime, and their browser refreshes what's on screen through the app's
// own signed-in API. The message carries no data, only which workspace changed.

// only a real project address counts (a pulled "Sensitive" Vercel variable comes back as a placeholder)
const url = () => {
	const value = process.env.SUPABASE_URL?.trim().replace(/\/$/, "");
	return value?.startsWith("https://") ? value : undefined;
};
const key = () => process.env.SUPABASE_ANON_KEY;
/**
 * Private channels: browsers join with a signed-in token and Supabase checks membership
 * (migration realtime_private_channels). Turned on with REALTIME_PRIVATE=1 once Supabase trusts
 * Zadaci's tokens; the server then sends with the secret key, which never leaves the server.
 */
const secretKey = () =>
	process.env.REALTIME_PRIVATE === "1"
		? process.env.SUPABASE_SECRET_KEY?.trim() || undefined
		: undefined;

/** The settings the browser needs to listen (null when Supabase isn't set up). */
export const realtimeConfig = () => {
	const u = url();
	const k = key();
	return u && k ? { url: u, anonKey: k, private: !!secretKey() } : null;
};

/**
 * Tells everyone viewing this workspace to refresh. Never slows down or fails the change itself.
 * `from` is the tab that made the change: it already shows it, so it skips the refresh.
 */
export function announceChange(slug: string, from?: string | null) {
	if (!url() || !key() || !slug) return;
	const send = (async () => {
		const [ws] = await db
			.select({ id: tables.workspace.id })
			.from(tables.workspace)
			.where(eq(tables.workspace.slug, slug));
		if (!ws) return;
		const res = await fetch(`${url()}/realtime/v1/api/broadcast`, {
			method: "POST",
			headers: {
				apikey: secretKey() ?? (key() as string),
				authorization: `Bearer ${secretKey() ?? key()}`,
				"content-type": "application/json",
			},
			body: JSON.stringify({
				messages: [
					{
						topic: `ws:${ws.id}`,
						event: "changed",
						payload: from ? { from } : {},
						private: !!secretKey(),
					},
				],
			}),
			signal: AbortSignal.timeout(4000),
		});
		// a refused send (a wrong or missing key) would otherwise fail without a trace
		if (!res.ok) throw new Error(`Supabase answered ${res.status}`);
	})().catch((error) =>
		console.warn("[realtime] couldn't announce a change:", String(error)),
	);
	waitUntil(send);
}

/** The workspace a mutation changed: its fields' `slug` argument, as written or as a variable. */
export function mutationSlugs(
	document: DocumentNode,
	variables: Record<string, unknown> | null | undefined,
	operationName?: string | null,
) {
	const op = getOperationAST(document, operationName);
	if (op?.operation !== "mutation") return [];
	const slugs = new Set<string>();
	for (const field of op.selectionSet.selections) {
		if (field.kind !== Kind.FIELD) continue;
		const arg = field.arguments?.find((a) => a.name.value === "slug")?.value;
		const value =
			arg?.kind === Kind.STRING
				? arg.value
				: arg?.kind === Kind.VARIABLE
					? variables?.[arg.name.value]
					: undefined;
		if (typeof value === "string") slugs.add(value);
	}
	return [...slugs];
}
