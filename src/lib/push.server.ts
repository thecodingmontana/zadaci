import { eq, inArray } from "drizzle-orm";
import webpush from "web-push";
import { db, tables } from "#/db";

// Web push to the browsers and phones people turned on in Settings → Push. The service
// worker (public/sw.js) shows each message and opens its link when tapped.

const publicKey = process.env.VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;
// No keys (local setups, tests): pushes are skipped, like emails without a Resend key.
const ready = !!(publicKey && privateKey);
// push services want a contact; an http://localhost site URL would be refused, so use the mail sender
if (ready)
	webpush.setVapidDetails(
		"mailto:noreply@thegoodslab.tech",
		publicKey,
		privateKey,
	);

export const pushPublicKey = () => (ready ? (publicKey ?? null) : null);

export type PushMessage = {
	userId: string;
	title: string;
	body?: string;
	url: string;
	/** a repeat with the same tag replaces the earlier notification instead of stacking */
	tag?: string;
};

/** Sends each message to every device of its person; forgets devices the browser dropped. */
export async function sendPushes(messages: PushMessage[]) {
	if (!ready || !messages.length) return 0;
	const subs = await db
		.select()
		.from(tables.push_subscription)
		.where(
			inArray(tables.push_subscription.user_id, [
				...new Set(messages.map((m) => m.userId)),
			]),
		);
	let sent = 0;
	await Promise.allSettled(
		messages.flatMap(({ userId, ...message }) =>
			subs
				.filter((s) => s.user_id === userId)
				.map(async (s) => {
					try {
						await webpush.sendNotification(
							{
								endpoint: s.endpoint,
								keys: { p256dh: s.p256dh, auth: s.auth },
							},
							JSON.stringify(message),
							{ TTL: 86_400 },
						);
						sent++;
					} catch (error) {
						const { statusCode, body } = error as {
							statusCode?: number;
							body?: string;
						};
						console.error(
							`[push] ${new URL(s.endpoint).host} answered ${statusCode ?? (error as Error).message}: ${String(body ?? "").slice(0, 200)}`,
						);
						// 404/410: the person unsubscribed or reinstalled; the endpoint is gone for good
						if (statusCode === 404 || statusCode === 410)
							await db
								.delete(tables.push_subscription)
								.where(eq(tables.push_subscription.id, s.id));
					}
				}),
		),
	);
	return sent;
}
