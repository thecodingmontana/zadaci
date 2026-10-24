import {
	createCipheriv,
	createDecipheriv,
	hkdfSync,
	randomBytes,
} from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db, tables } from "#/db";
import { modelFor, type ProviderId, providerOf } from "./providers";

// People's own AI keys (bring your own key). How they're kept safe:
// - encrypted with AES-256-GCM under AI_KEYS_SECRET, a secret that lives in the server's
//   environment, not the database: a database dump, backup or admin sees only ciphertext
// - each ciphertext is bound to its person and provider, so it can't be moved to another account
// - never sent back to a browser (only a hint like …a1b2), never logged, decrypted only in memory
//   to call that provider
// If the secret changes, saved keys can't be read and people add theirs again.

const secret = () => {
	const base = process.env.AI_KEYS_SECRET || process.env.BETTER_AUTH_SECRET;
	if (!base) throw new Error("AI_KEYS_SECRET is missing");
	return Buffer.from(hkdfSync("sha256", base, "zadaci", "ai-user-keys", 32));
};

const b64 = (b: Buffer) => b.toString("base64url");
const bound = (userId: string, provider: string) =>
	Buffer.from(`${userId}:${provider}`);

export function sealKey(plain: string, userId: string, provider: string) {
	const iv = randomBytes(12);
	const cipher = createCipheriv("aes-256-gcm", secret(), iv);
	cipher.setAAD(bound(userId, provider));
	const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
	return `${b64(iv)}.${b64(cipher.getAuthTag())}.${b64(body)}`;
}

export function openKey(sealed: string, userId: string, provider: string) {
	const [iv, tag, body] = sealed
		.split(".")
		.map((p) => Buffer.from(p, "base64url"));
	if (!iv || !tag || !body) return null;
	try {
		const decipher = createDecipheriv("aes-256-gcm", secret(), iv);
		decipher.setAAD(bound(userId, provider));
		decipher.setAuthTag(tag);
		return Buffer.concat([decipher.update(body), decipher.final()]).toString(
			"utf8",
		);
	} catch {
		// a changed secret, a tampered value or a row moved to another person: no key
		return null;
	}
}

export const keyHint = (key: string) => `…${key.slice(-4)}`;

export type ActiveKey = { provider: ProviderId; key: string; model: string };

/** The key the person chose for the assistant, or null when they use the shared one. */
export async function activeKey(userId: string): Promise<ActiveKey | null> {
	const [row] = await db
		.select()
		.from(tables.ai_user_key)
		.where(
			and(
				eq(tables.ai_user_key.user_id, userId),
				eq(tables.ai_user_key.active, true),
			),
		);
	const provider = row && providerOf(row.provider);
	if (!row || !provider) return null;
	const key = openKey(row.cipher, userId, row.provider);
	return key
		? { provider: provider.id, key, model: modelFor(provider, row.model) }
		: null;
}

const timeout = () => AbortSignal.timeout(8000);

/** Asks the provider whether a key works (a free, read-only call), before it's saved. */
export async function checkKey(
	providerId: string,
	key: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
	const provider = providerOf(providerId);
	if (!provider) return { ok: false, error: "Pick a provider for the key." };
	if (!provider.keyPattern.test(key))
		return {
			ok: false,
			error: `That doesn't look like a ${provider.label} key (it looks like ${provider.keyExample}).`,
		};
	const request: Record<ProviderId, () => Promise<Response>> = {
		openrouter: () =>
			fetch("https://openrouter.ai/api/v1/key", {
				headers: { authorization: `Bearer ${key}` },
				signal: timeout(),
			}),
		anthropic: () =>
			fetch("https://api.anthropic.com/v1/models?limit=1", {
				headers: { "x-api-key": key, "anthropic-version": "2023-06-01" },
				signal: timeout(),
			}),
		openai: () =>
			fetch("https://api.openai.com/v1/models", {
				headers: { authorization: `Bearer ${key}` },
				signal: timeout(),
			}),
		gemini: () =>
			fetch(
				"https://generativelanguage.googleapis.com/v1beta/models?pageSize=1",
				{ headers: { "x-goog-api-key": key }, signal: timeout() },
			),
	};
	try {
		const res = await request[provider.id]();
		if ([400, 401, 403].includes(res.status))
			return {
				ok: false,
				error: `${provider.label} didn't accept that key. Check it and try again.`,
			};
		if (!res.ok)
			return {
				ok: false,
				error: `Couldn't check the key with ${provider.label}. Try again in a moment.`,
			};
		return { ok: true };
	} catch {
		return {
			ok: false,
			error: `Couldn't reach ${provider.label} to check the key. Try again in a moment.`,
		};
	}
}
