// Embeds in notes: a pasted share link becomes the provider's embed address. Only these
// providers are embedded, so a note can't frame an arbitrary page.

type Provider = {
	name: string;
	/** share link → embed address, or null when the link isn't this provider's */
	toEmbed: (url: URL) => string | null;
	/** whether a stored embed address is this provider's */
	isEmbed: (url: URL) => boolean;
};

/** A Google Maps link (a view, a place or a search) as an address the page may frame. */
function mapEmbed(u: URL) {
	if (!/^(www\.|maps\.)?google\.com$/.test(u.hostname)) return null;
	if (u.pathname === "/maps/embed") return u.href;
	if (!u.pathname.startsWith("/maps") && u.hostname !== "maps.google.com")
		return null;
	// "/maps/@-1.28,36.72,15z" or "…/place/Mombasa/@-4.04,39.66,12z/…"
	const at = u.pathname.match(
		/@(-?\d+\.?\d*),(-?\d+\.?\d*)(?:,(\d+(?:\.\d+)?)z)?/,
	);
	const name = u.pathname.match(/\/(?:place|search)\/([^/]+)/)?.[1];
	const q = name
		? decodeURIComponent(name.replace(/\+/g, " "))
		: (u.searchParams.get("q") ?? (at ? `${at[1]},${at[2]}` : null));
	if (!q) return null;
	const zoom = at?.[3] ? Math.round(Number(at[3])) : 14;
	// the keyless embed page Google itself redirects "?q=…&output=embed" to
	return `https://www.google.com/maps/embed?origin=mfe&pb=!1m3!2m1!1s${encodeURIComponent(q)}!6i${zoom}`;
}

/** Google's short map links, which have to be followed to the full link before embedding. */
export const isShortMapLink = (link: string) =>
	/^https:\/\/(maps\.app\.goo\.gl|goo\.gl\/maps)\//.test(link.trim());

const PROVIDERS: Provider[] = [
	{
		name: "Vimeo",
		toEmbed: (u) => {
			const id = u.hostname.endsWith("vimeo.com")
				? u.pathname.match(/\/(?:video\/)?(\d+)/)?.[1]
				: null;
			return id ? `https://player.vimeo.com/video/${id}` : null;
		},
		isEmbed: (u) =>
			u.hostname === "player.vimeo.com" && /^\/video\/\d+$/.test(u.pathname),
	},
	{
		name: "Loom",
		toEmbed: (u) => {
			const id = u.hostname.endsWith("loom.com")
				? u.pathname.match(/\/(?:share|embed)\/([a-f0-9]+)/)?.[1]
				: null;
			return id ? `https://www.loom.com/embed/${id}` : null;
		},
		isEmbed: (u) =>
			u.hostname === "www.loom.com" && /^\/embed\/[a-f0-9]+$/.test(u.pathname),
	},
	{
		name: "Figma",
		toEmbed: (u) =>
			u.hostname.endsWith("figma.com") &&
			/^\/(file|design|proto|board)\//.test(u.pathname)
				? `https://www.figma.com/embed?embed_host=zadaci&url=${encodeURIComponent(u.href)}`
				: null,
		isEmbed: (u) => u.hostname === "www.figma.com" && u.pathname === "/embed",
	},
	{
		name: "CodePen",
		toEmbed: (u) => {
			const m =
				u.hostname === "codepen.io"
					? u.pathname.match(/^\/([\w-]+)\/(?:pen|embed)\/(\w+)/)
					: null;
			return m
				? `https://codepen.io/${m[1]}/embed/${m[2]}?default-tab=result`
				: null;
		},
		isEmbed: (u) =>
			u.hostname === "codepen.io" && /^\/[\w-]+\/embed\/\w+$/.test(u.pathname),
	},
	{
		name: "Spotify",
		toEmbed: (u) => {
			const m =
				u.hostname === "open.spotify.com"
					? u.pathname.match(
							/^\/(?:embed\/)?(track|album|playlist|episode|show)\/(\w+)/,
						)
					: null;
			return m ? `https://open.spotify.com/embed/${m[1]}/${m[2]}` : null;
		},
		isEmbed: (u) =>
			u.hostname === "open.spotify.com" &&
			/^\/embed\/(track|album|playlist|episode|show)\/\w+$/.test(u.pathname),
	},
	{
		name: "Google Maps",
		// share links can't be framed, so a place or a view becomes the keyless embed address
		toEmbed: mapEmbed,
		isEmbed: (u) =>
			u.hostname === "www.google.com" && u.pathname === "/maps/embed",
	},
];

export const EMBED_PROVIDERS = PROVIDERS.map((p) => p.name);

function parse(value: string) {
	try {
		const url = new URL(value.trim());
		return url.protocol === "https:" ? url : null;
	} catch {
		return null;
	}
}

/** The embed address and provider for a pasted link, or null when we can't embed it. */
export function toEmbed(link: string) {
	const url = parse(link);
	if (!url) return null;
	for (const p of PROVIDERS) {
		const src = p.toEmbed(url);
		if (src) return { src, provider: p.name };
	}
	return null;
}

/** Whether a stored embed address is one we allow in a note. */
export function isEmbedSrc(src: unknown) {
	const url = typeof src === "string" ? parse(src) : null;
	return !!url && PROVIDERS.some((p) => p.isEmbed(url));
}

/** YouTube video links as the editor stores them: watch, short, shorts or embed links. */
export function isYoutubeSrc(src: unknown) {
	const url = typeof src === "string" ? parse(src) : null;
	if (!url) return false;
	const host = url.hostname.replace(/^(www|m)\./, "");
	if (host === "youtu.be") return /^\/[\w-]+$/.test(url.pathname);
	if (host !== "youtube.com" && host !== "youtube-nocookie.com") return false;
	return (
		(url.pathname === "/watch" &&
			/^[\w-]+$/.test(url.searchParams.get("v") ?? "")) ||
		/^\/(embed|shorts|live)\/[\w-]+$/.test(url.pathname)
	);
}

/** Image addresses a note can show: https, and nothing that could break out of the attribute. */
export function isImageSrc(src: unknown) {
	return (
		typeof src === "string" &&
		src.length <= 2000 &&
		!/["'<>\s\\]/.test(src) &&
		!!parse(src)
	);
}
