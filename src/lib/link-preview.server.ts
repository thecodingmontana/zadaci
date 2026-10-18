import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";

// Reads a web page's title, description and preview image for a bookmark. The server
// fetches a URL the user typed, so it refuses anything that points back inside a network
// (localhost, private ranges, cloud metadata) and caps time, redirects and size.

export type LinkKind = "article" | "document" | "video";
export type LinkPreview = {
	url: string;
	title: string;
	description: string | null;
	image: string | null;
	site: string | null;
	kind: LinkKind;
};

const MAX_URL = 2000;
const MAX_BYTES = 512 * 1024;
const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 5000;
const USER_AGENT =
	"Mozilla/5.0 (compatible; ZadaciBot/1.0; +https://zadaci.vercel.app)";

const blocked = new BlockList();
for (const [net, prefix] of [
	["0.0.0.0", 8],
	["10.0.0.0", 8],
	["100.64.0.0", 10],
	["127.0.0.0", 8],
	["169.254.0.0", 16],
	["172.16.0.0", 12],
	["192.0.0.0", 24],
	["192.168.0.0", 16],
	["198.18.0.0", 15],
	["224.0.0.0", 4],
	["240.0.0.0", 4],
] as const)
	blocked.addSubnet(net, prefix, "ipv4");
for (const [net, prefix] of [
	["::", 128],
	["::1", 128],
	["fc00::", 7],
	["fe80::", 10],
] as const)
	blocked.addSubnet(net, prefix, "ipv6");

/** Whether an IP address is on the public internet. */
export function isPublicAddress(ip: string) {
	// IPv4-mapped and NAT64 addresses carry an IPv4 address: judge that one
	const dotted = /^(?:::ffff:|64:ff9b::)(\d+\.\d+\.\d+\.\d+)$/i.exec(ip)?.[1];
	if (dotted) return isPublicAddress(dotted);
	const hex = /^(?:::ffff:|64:ff9b::)([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i.exec(
		ip,
	);
	if (hex) {
		const n = (parseInt(hex[1] ?? "", 16) << 16) | parseInt(hex[2] ?? "", 16);
		return isPublicAddress(
			[24, 16, 8, 0].map((b) => (n >>> b) & 255).join("."),
		);
	}
	const family = isIP(ip);
	if (!family) return false;
	return !blocked.check(ip, family === 4 ? "ipv4" : "ipv6");
}

/** A link the user typed, as an http(s) URL on a normal port, or null. */
export function cleanUrl(input: string) {
	const raw = input.trim();
	if (!raw || raw.length > MAX_URL) return null;
	try {
		const url = new URL(/^[a-z][\w+.-]*:/i.test(raw) ? raw : `https://${raw}`);
		if (url.protocol !== "https:" && url.protocol !== "http:") return null;
		if (url.username || url.password || url.port || !url.hostname.includes("."))
			return null;
		return url.href;
	} catch {
		return null;
	}
}

const VIDEO_HOSTS = [
	"youtube.com",
	"youtu.be",
	"vimeo.com",
	"loom.com",
	"twitch.tv",
	"tiktok.com",
	"dailymotion.com",
];
const DOC_HOSTS = [
	"docs.google.com",
	"drive.google.com",
	"notion.so",
	"notion.site",
];
const onHost = (host: string, list: string[]) =>
	list.some((h) => host === h || host.endsWith(`.${h}`));

export function kindOf(url: string, contentType = "", ogType = ""): LinkKind {
	const { hostname, pathname } = new URL(url);
	if (onHost(hostname, VIDEO_HOSTS) || ogType.startsWith("video"))
		return "video";
	if (
		onHost(hostname, DOC_HOSTS) ||
		/\.(pdf|docx?|pptx?|xlsx?|odt|txt|md)$/i.test(pathname) ||
		/pdf|msword|officedocument/.test(contentType)
	)
		return "document";
	return "article";
}

const ENTITIES: Record<string, string> = {
	amp: "&",
	lt: "<",
	gt: ">",
	quot: '"',
	apos: "'",
	nbsp: " ",
};
const decode = (s: string) =>
	s
		.replace(/&#x([0-9a-f]+);/gi, (_, h) =>
			String.fromCodePoint(parseInt(h, 16)),
		)
		.replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
		.replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m)
		.replace(/\s+/g, " ")
		.trim();

/** An image the page points at, as an https URL, or null. */
function imageUrl(src: string | undefined, base: string) {
	if (!src) return null;
	try {
		const url = new URL(src, base);
		if (url.protocol === "http:") url.protocol = "https:";
		return url.protocol === "https:" && url.href.length <= MAX_URL
			? url.href
			: null;
	} catch {
		return null;
	}
}

const siteOf = (url: string) => new URL(url).hostname.replace(/^www\./, "");

/** The preview details in a page's HTML (Open Graph, Twitter cards, then plain tags). */
export function parsePreview(
	html: string,
	url: string,
	contentType = "text/html",
): LinkPreview {
	const meta = new Map<string, string>();
	for (const [tag] of html.matchAll(/<meta\b[^>]*>/gi)) {
		const attr = (name: string) =>
			new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, "i").exec(tag);
		const key = attr("property") ?? attr("name");
		const content = attr("content");
		const k = (key?.[2] ?? key?.[3])?.toLowerCase();
		const v = content?.[2] ?? content?.[3];
		if (k && v && !meta.has(k)) meta.set(k, decode(v));
	}
	const first = (...keys: string[]) =>
		keys.map((k) => meta.get(k)).find(Boolean) || undefined;
	const titleTag = /<title[^>]*>([^<]*)<\/title>/i.exec(html)?.[1];
	const title =
		first("og:title", "twitter:title") ?? (titleTag && decode(titleTag));
	return {
		url,
		title: (title || siteOf(url)).slice(0, 300),
		description:
			first("og:description", "description", "twitter:description")?.slice(
				0,
				600,
			) ?? null,
		image: imageUrl(
			first("og:image", "og:image:url", "twitter:image", "twitter:image:src"),
			url,
		),
		site: (first("og:site_name") ?? siteOf(url)).slice(0, 200),
		kind: kindOf(url, contentType, first("og:type")),
	};
}

/** Throws unless every address the host resolves to is public. */
async function checkHost(url: URL) {
	const host = url.hostname.replace(/^\[|\]$/g, "");
	const addresses = isIP(host)
		? [{ address: host }]
		: await lookup(host, { all: true, verbatim: true });
	if (!addresses.length || !addresses.every((a) => isPublicAddress(a.address)))
		throw new Error("That address can't be fetched");
}

async function readCapped(res: Response) {
	const reader = res.body?.getReader();
	if (!reader) return "";
	const chunks: Uint8Array[] = [];
	let size = 0;
	while (size < MAX_BYTES) {
		const { done, value } = await reader.read();
		if (done) break;
		chunks.push(value);
		size += value.byteLength;
	}
	await reader.cancel().catch(() => {});
	return new TextDecoder().decode(Buffer.concat(chunks).subarray(0, MAX_BYTES));
}

/** YouTube shows servers a consent page, so its oEmbed endpoint gives the details. */
async function youtube(url: string, signal: AbortSignal) {
	try {
		const res = await fetch(
			`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`,
			{ signal },
		);
		if (!res.ok) return null;
		const data = (await res.json()) as {
			title?: string;
			author_name?: string;
			thumbnail_url?: string;
		};
		return {
			url,
			title: (data.title || "YouTube video").slice(0, 300),
			description: data.author_name ? `by ${data.author_name}` : null,
			image: imageUrl(data.thumbnail_url, url),
			site: "YouTube",
			kind: "video" as const,
		};
	} catch {
		return null;
	}
}

/**
 * Fetches a link's preview. A page that can't be read still gives a usable preview
 * (its address as the title); only links that aren't allowed at all throw.
 */
export async function fetchPreview(input: string): Promise<LinkPreview> {
	const start = cleanUrl(input);
	if (!start) throw new Error("Enter a web address (https://…)");
	const fallback: LinkPreview = {
		url: start,
		title: siteOf(start),
		description: null,
		image: null,
		site: siteOf(start),
		kind: kindOf(start),
	};
	const signal = AbortSignal.timeout(TIMEOUT_MS);
	if (onHost(new URL(start).hostname, ["youtube.com", "youtu.be"]))
		return (await youtube(start, signal)) ?? fallback;
	let url = start;
	for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
		const target = new URL(url);
		// shortcut: the host is resolved again by fetch, so a DNS answer that changes between
		// the check and the request (rebinding) isn't caught; pin the address if that matters
		await checkHost(target);
		let res: Response;
		try {
			res = await fetch(target, {
				redirect: "manual",
				signal,
				headers: { "user-agent": USER_AGENT, accept: "text/html,*/*;q=0.5" },
			});
		} catch {
			return fallback;
		}
		const next = res.headers.get("location");
		if (res.status >= 300 && res.status < 400 && next) {
			await res.body?.cancel().catch(() => {});
			const resolved = cleanUrl(new URL(next, url).href);
			if (!resolved) return fallback;
			url = resolved;
			continue;
		}
		const type = res.headers.get("content-type") ?? "";
		if (!res.ok || !type.includes("html")) {
			await res.body?.cancel().catch(() => {});
			return { ...fallback, url, kind: kindOf(url, type) };
		}
		try {
			return parsePreview(await readCapped(res), url, type);
		} catch {
			return { ...fallback, url };
		}
	}
	return fallback;
}
