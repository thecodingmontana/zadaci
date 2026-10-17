// File kinds for attachments (reference helpers FT / fileType).

export const FILE_TYPES = {
	fig: {
		c: "#8662C9",
		icon: "icon-[solar--pen-new-square-linear]",
		name: "Figma",
	},
	pdf: {
		c: "#C4473A",
		icon: "icon-[solar--document-text-linear]",
		name: "PDF",
	},
	zip: { c: "#6B7280", icon: "icon-[solar--zip-file-linear]", name: "Archive" },
	img: { c: "#23918A", icon: "icon-[solar--gallery-linear]", name: "Image" },
	sheet: {
		c: "#3D8E5F",
		icon: "icon-[solar--file-text-linear]",
		name: "Spreadsheet",
	},
	doc: {
		c: "#3B82C4",
		icon: "icon-[solar--document-text-linear]",
		name: "Document",
	},
	code: { c: "#C48A1E", icon: "icon-[solar--code-file-linear]", name: "Code" },
	other: { c: "#6B7280", icon: "icon-[solar--file-linear]", name: "File" },
} as const;
export type FileKind = keyof typeof FILE_TYPES;

export function fileKind(name: string): FileKind {
	const e = (name.split(".").pop() ?? "").toLowerCase();
	if (e === "fig") return "fig";
	if (e === "pdf") return "pdf";
	if (["zip", "rar", "7z"].includes(e)) return "zip";
	if (["png", "jpg", "jpeg", "gif", "webp", "svg", "heic", "avif"].includes(e))
		return "img";
	if (["xlsx", "xls", "csv", "numbers"].includes(e)) return "sheet";
	if (["doc", "docx", "txt", "md", "pages", "rtf"].includes(e)) return "doc";
	if (["js", "ts", "tsx", "json", "html", "css", "py"].includes(e))
		return "code";
	return "other";
}

/** "860 KB", "4.2 MB". */
export function fmtSize(bytes: number) {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 ** 2) return `${Math.round(bytes / 1024)} KB`;
	return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** A file we signed an upload slot for: our Cloudinary account, that folder, nothing appended. */
export function isUploadUrl(url: string, cloud: string, folder: string) {
	let u: URL;
	try {
		u = new URL(url);
	} catch {
		return false;
	}
	if (u.origin !== "https://res.cloudinary.com" || u.search || u.hash)
		return false;
	return new RegExp(
		`^/${escapeRe(cloud)}/(image|video|raw)/upload/(v\\d+/)?${escapeRe(folder)}/[a-z0-9]+(\\.[A-Za-z0-9]+)?$`,
	).test(u.pathname);
}
