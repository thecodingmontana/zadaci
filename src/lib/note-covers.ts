// Page covers, like Notion's: a colour or gradient from the gallery, an uploaded image, or
// an image link. Stored as "gallery:<key>" or an https URL, plus a vertical position (0–100).

export const COVER_GALLERY: Record<string, string> = {
	coral: "#e85d5d",
	amber: "#f6c04f",
	ocean: "#1f9bd1",
	cream: "#fdeee2",
	sage: "#8fb39a",
	ink: "#2c2f36",
	lagoon: "linear-gradient(180deg, #4fc9cf 0%, #d8b8a8 100%)",
	flamingo: "linear-gradient(135deg, #ff4f8b 0%, #ff2e6a 100%)",
	ember: "linear-gradient(160deg, #e07b5a 0%, #f21a0a 100%)",
	mist: "radial-gradient(circle at 70% 30%, #f1c3b5 0%, #a9dce6 70%)",
	dusk: "linear-gradient(135deg, #2b6cb0 0%, #e2b8d8 55%, #e53e1d 100%)",
	orchid: "linear-gradient(160deg, #6b46c1 0%, #d6457a 100%)",
	harbor: "linear-gradient(160deg, #2a3f63 0%, #c8a98c 100%)",
};

const GALLERY = /^gallery:([a-z]+)$/;

/** An https image link that is safe to put inside CSS url("…"). */
export function isCoverLink(value: string) {
	if (value.length > 1000 || /["'()\\\s<>]/.test(value)) return false;
	try {
		return new URL(value).protocol === "https:";
	} catch {
		return false;
	}
}

/** Whether a stored cover value is one we can show. */
export function isCover(value: string) {
	const key = value.match(GALLERY)?.[1];
	return key ? key in COVER_GALLERY : isCoverLink(value);
}

/** The CSS background for a cover, or null when it isn't a cover we know. */
export function coverBackground(value: string | null, y = 50) {
	if (!value) return null;
	const key = value.match(GALLERY)?.[1];
	if (key)
		return COVER_GALLERY[key] ? { background: COVER_GALLERY[key] } : null;
	if (!isCoverLink(value)) return null;
	return {
		backgroundImage: `url("${value}")`,
		backgroundSize: "cover",
		backgroundPosition: `center ${Math.min(100, Math.max(0, y))}%`,
	};
}

export const randomGalleryCover = () => {
	const keys = Object.keys(COVER_GALLERY);
	return `gallery:${keys[Math.floor(Math.random() * keys.length)]}`;
};
