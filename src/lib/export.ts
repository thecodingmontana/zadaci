// Export and import helpers: tasks to CSV, a page to Markdown, and a browser's bookmark file.

/** One CSV cell: quoted when needed, and a leading = + - @ neutralised so spreadsheets don't run it. */
const cell = (value: unknown) => {
	let text = value == null ? "" : String(value);
	if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
	return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export const toCsv = (rows: unknown[][]) =>
	rows.map((row) => row.map(cell).join(",")).join("\r\n");

/** Offers text to the browser as a downloaded file. */
export function download(filename: string, text: string, type: string) {
	const url = URL.createObjectURL(new Blob([text], { type }));
	const a = Object.assign(document.createElement("a"), {
		href: url,
		download: filename,
	});
	a.click();
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** A name that works as a file name everywhere. */
export const fileName = (name: string, ext: string) =>
	`${
		name
			.replace(/[\\/:*?"<>|]+/g, " ")
			.replace(/\s+/g, " ")
			.trim()
			.slice(0, 80) || "untitled"
	}.${ext}`;

type Node = {
	type: string;
	text?: string;
	attrs?: Record<string, unknown>;
	marks?: { type: string; attrs?: Record<string, unknown> }[];
	content?: Node[];
};

function inline(nodes: Node[] = []): string {
	return nodes
		.map((n) => {
			if (n.type === "hardBreak") return "  \n";
			if (n.type !== "text") return inline(n.content);
			let t = n.text ?? "";
			for (const m of n.marks ?? []) {
				if (m.type === "bold") t = `**${t}**`;
				else if (m.type === "italic") t = `_${t}_`;
				else if (m.type === "strike") t = `~~${t}~~`;
				else if (m.type === "code") t = `\`${t}\``;
				else if (m.type === "link")
					t = `[${t}](${String(m.attrs?.href ?? "")})`;
			}
			return t;
		})
		.join("");
}

function block(n: Node, indent = ""): string {
	const kids = n.content ?? [];
	const list = (bullet: (i: number, item: Node) => string) =>
		kids
			.map((item, i) => {
				const [first, ...rest] = item.content ?? [];
				const head = `${indent}${bullet(i, item)}${first ? inline(first.content) : ""}`;
				const nested = rest.map((r) => block(r, `${indent}  `)).join("\n");
				return nested ? `${head}\n${nested}` : head;
			})
			.join("\n");
	switch (n.type) {
		case "heading":
			return `${"#".repeat(Number(n.attrs?.level ?? 1))} ${inline(kids)}`;
		case "paragraph":
			return `${indent}${inline(kids)}`;
		case "bulletList":
			return list(() => "- ");
		case "orderedList":
			return list((i) => `${i + 1}. `);
		case "taskList":
			return list((_, item) => (item.attrs?.checked ? "- [x] " : "- [ ] "));
		case "blockquote":
		case "callout":
			return kids
				.map((k) => block(k))
				.join("\n")
				.split("\n")
				.map((l) => `> ${l}`)
				.join("\n");
		case "codeBlock":
			return `\`\`\`${String(n.attrs?.language ?? "")}\n${inline(kids)}\n\`\`\``;
		case "horizontalRule":
			return "---";
		case "image":
			return `![${String(n.attrs?.alt ?? "")}](${String(n.attrs?.src ?? "")})`;
		case "youtube":
		case "embed":
			return String(n.attrs?.src ?? "");
		case "linkCard":
			return `[${String(n.attrs?.title || n.attrs?.url)}](${String(n.attrs?.url)})`;
		case "table": {
			const rows = kids.map((r) =>
				(r.content ?? []).map((c) =>
					(c.content ?? []).map((p) => inline(p.content)).join(" "),
				),
			);
			if (!rows.length) return "";
			const width = Math.max(...rows.map((r) => r.length));
			const line = (r: string[]) =>
				`| ${Array.from({ length: width }, (_, i) => r[i] ?? "").join(" | ")} |`;
			return [
				line(rows[0] ?? []),
				line(Array(width).fill("---")),
				...rows.slice(1).map(line),
			].join("\n");
		}
		default:
			return kids.map((k) => block(k, indent)).join("\n\n");
	}
}

/** A page's Tiptap document as Markdown, with its title as the top heading. */
export function docToMarkdown(title: string, doc: unknown) {
	const body =
		(doc as Node | null)?.content?.map((n) => block(n)).join("\n\n") ?? "";
	return `${`# ${title || "Untitled"}\n\n${body}`.trim()}\n`;
}

const decode = (s: string) =>
	s
		.replace(/<[^>]*>/g, "")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&amp;/g, "&")
		.trim();

// the top-level folders every browser makes; links in them get no tag
const ROOTS =
	/^(bookmarks bar|bookmarks toolbar|other bookmarks|mobile bookmarks|favorites bar|favourites bar)$/i;

/**
 * Links from a browser's bookmark export (the "Netscape" HTML every browser writes), each with
 * the folder it was in, so folders can become tags.
 */
export function parseBookmarkExport(html: string) {
	const out: { url: string; title: string; folder: string | null }[] = [];
	// a folder is an <H3> whose links follow inside the next <DL>, closed by </DL>
	const folders: (string | null)[] = [];
	const token =
		/<h3[^>]*>([\s\S]*?)<\/h3>|<a\s[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>|<\/dl>/gi;
	for (const m of html.matchAll(token)) {
		if (m[1] !== undefined) {
			const name = decode(m[1]);
			folders.push(ROOTS.test(name) ? null : name);
		} else if (m[2] !== undefined) {
			const url = decode(m[2]);
			if (/^https?:\/\//i.test(url))
				out.push({
					url,
					title: decode(m[3] ?? "") || url,
					folder: [...folders].reverse().find((f) => f !== null) ?? null,
				});
		} else folders.pop();
	}
	return out;
}
