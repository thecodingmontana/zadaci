import assert from "node:assert/strict";
import { test } from "node:test";
import { docToMarkdown, fileName, parseBookmarkExport, toCsv } from "./export";

test("CSV quotes what needs quoting and defuses spreadsheet formulas", () => {
	assert.equal(
		toCsv([
			["Key", "Title"],
			["WEB-1", 'Say "hi", then go'],
			["WEB-2", '=HYPERLINK("http://evil")'],
			["WEB-3", null],
		]),
		'Key,Title\r\nWEB-1,"Say ""hi"", then go"\r\nWEB-2,"\'=HYPERLINK(""http://evil"")"\r\nWEB-3,',
	);
	assert.equal(fileName('Plan: Q4/"final"', "md"), "Plan Q4 final.md");
});

test("a page becomes Markdown: headings, lists, to-dos, links, code and tables", () => {
	const text = (
		t: string,
		marks?: { type: string; attrs?: Record<string, unknown> }[],
	) => ({ type: "text", text: t, ...(marks && { marks }) });
	const p = (...c: object[]) => ({ type: "paragraph", content: c });
	const doc = {
		type: "doc",
		content: [
			{ type: "heading", attrs: { level: 2 }, content: [text("Goals")] },
			p(
				text("Ship "),
				text("fast", [{ type: "bold" }]),
				text(", see "),
				text("docs", [{ type: "link", attrs: { href: "https://x.dev" } }]),
			),
			{
				type: "taskList",
				content: [
					{
						type: "taskItem",
						attrs: { checked: true },
						content: [p(text("Draft"))],
					},
					{
						type: "taskItem",
						attrs: { checked: false },
						content: [p(text("Review"))],
					},
				],
			},
			{
				type: "codeBlock",
				attrs: { language: "ts" },
				content: [text("const a = 1;")],
			},
			{
				type: "table",
				content: [
					{
						type: "tableRow",
						content: [
							{ type: "tableHeader", content: [p(text("A"))] },
							{ type: "tableHeader", content: [p(text("B"))] },
						],
					},
					{
						type: "tableRow",
						content: [
							{ type: "tableCell", content: [p(text("1"))] },
							{ type: "tableCell", content: [p(text("2"))] },
						],
					},
				],
			},
		],
	};
	assert.equal(
		docToMarkdown("Plan", doc),
		"# Plan\n\n## Goals\n\nShip **fast**, see [docs](https://x.dev)\n\n- [x] Draft\n- [ ] Review\n\n```ts\nconst a = 1;\n```\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n",
	);
});

test("a browser bookmark export gives links with their folder (not the browser's own roots)", () => {
	const html = `<!DOCTYPE NETSCAPE-Bookmark-file-1><H1>Bookmarks</H1><DL><p>
<DT><H3>Bookmarks bar</H3><DL><p>
  <DT><A HREF="https://a.com" ADD_DATE="1">A &amp; B</A>
  <DT><H3>Design</H3><DL><p>
    <DT><A HREF="https://figma.com">Figma</A>
    <DT><A HREF="javascript:alert(1)">Bad</A>
  </DL><p>
  <DT><A HREF="https://c.com"></A>
</DL><p>
</DL><p>`;
	assert.deepEqual(parseBookmarkExport(html), [
		{ url: "https://a.com", title: "A & B", folder: null },
		{ url: "https://figma.com", title: "Figma", folder: "Design" },
		{ url: "https://c.com", title: "https://c.com", folder: null },
	]);
});
