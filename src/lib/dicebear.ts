// DiceBear avatars for workspace icons. The server accepts only URLs built here.
export const DICEBEAR_STYLES = [
	"shapes",
	"glass",
	"rings",
	"identicon",
	"thumbs",
	"bottts-neutral",
	"fun-emoji",
	"icons",
	"pixel-art-neutral",
	"notionists-neutral",
	"adventurer-neutral",
	"lorelei-neutral",
] as const;

const BASE = "https://api.dicebear.com/9.x/";
const SEED_RE = /^[A-Za-z0-9]{6,32}$/;

export const dicebearUrl = (style: string, seed: string) =>
	`${BASE}${style}/svg?seed=${seed}`;

/** A batch of random avatars, cycling through the styles so every shuffle mixes them. */
export function randomAvatars(count: number) {
	const offset = Math.floor(Math.random() * DICEBEAR_STYLES.length);
	return Array.from({ length: count }, (_, i) => {
		const style = DICEBEAR_STYLES[
			(offset + i) % DICEBEAR_STYLES.length
		] as string;
		const seed = Math.random().toString(36).slice(2, 12).padEnd(6, "0");
		return { style, url: dicebearUrl(style, seed) };
	});
}

export function isDicebearUrl(value: string) {
	try {
		const url = new URL(value);
		const [, version, style, file] = url.pathname.split("/");
		return (
			url.origin === "https://api.dicebear.com" &&
			version === "9.x" &&
			(DICEBEAR_STYLES as readonly string[]).includes(style ?? "") &&
			file === "svg" &&
			[...url.searchParams.keys()].join() === "seed" &&
			SEED_RE.test(url.searchParams.get("seed") ?? "")
		);
	} catch {
		return false;
	}
}
