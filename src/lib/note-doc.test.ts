import assert from "node:assert/strict";
import { test } from "node:test";
import { checkDoc } from "./note-doc";

const doc = (...content: unknown[]) => ({ type: "doc", content });
const p = (...content: unknown[]) => ({ type: "paragraph", content });
const t = (text: string, marks?: unknown[]) => ({ type: "text", text, marks });

test("keeps allowed blocks and marks and extracts plain text", () => {
	const { doc: clean, text } = checkDoc(
		doc(
			{ type: "heading", attrs: { level: 2 }, content: [t("Plan")] },
			p(t("Ship "), t("now", [{ type: "bold" }])),
		),
	);
	assert.equal(text, "Plan\nShip now");
	assert.deepEqual(clean.content?.[1]?.content?.[1]?.marks, [{ type: "bold" }]);
});

test("rejects unknown blocks, unsafe links and nested attribute objects", () => {
	assert.throws(() => checkDoc(doc({ type: "script" })), /Unsupported block/);
	assert.throws(
		() =>
			checkDoc(
				doc(
					p(t("x", [{ type: "link", attrs: { href: "javascript:alert(1)" } }])),
				),
			),
		/Links must start/,
	);
	assert.throws(
		() => checkDoc(doc({ type: "paragraph", attrs: { style: { a: 1 } } })),
		/Bad note content/,
	);
	assert.throws(() => checkDoc(p(t("not a doc"))), /Bad note content/);
});

test("drops fields the editor doesn't use", () => {
	const { doc: clean } = checkDoc({ type: "doc", content: [], onload: "x" });
	assert.deepEqual(clean, { type: "doc", content: [] });
});

test("images and embeds only keep addresses we allow", () => {
	const img = (src: string) => doc({ type: "image", attrs: { src, alt: "" } });
	assert.doesNotThrow(() =>
		checkDoc(img("https://res.cloudinary.com/x/image/upload/a.png")),
	);
	assert.throws(() => checkDoc(img("javascript:alert(1)")), /can't be shown/);
	assert.throws(
		() =>
			checkDoc(
				doc({ type: "embed", attrs: { src: "https://evil.example.com" } }),
			),
		/can't be shown/,
	);
	assert.doesNotThrow(() =>
		checkDoc(
			doc({
				type: "youtube",
				attrs: { src: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ" },
			}),
		),
	);
	assert.doesNotThrow(() =>
		checkDoc(
			doc({
				type: "table",
				content: [
					{
						type: "tableRow",
						content: [
							{
								type: "tableCell",
								attrs: { colspan: 1, rowspan: 1, colwidth: [120] },
								content: [p(t("a"))],
							},
						],
					},
				],
			}),
		),
	);
});

test("keeps colours, code themes and uploaded files, but only safe ones", () => {
	const coloured = p(
		t("hi", [
			{ type: "textStyle", attrs: { color: "blue" } },
			{ type: "highlight", attrs: { color: "yellow" } },
		]),
	);
	const code = {
		type: "codeBlock",
		attrs: {
			language: "ts",
			themes: { light: "one-light", dark: "one-dark-pro" },
		},
		content: [t("x")],
	};
	const file = {
		type: "noteFile",
		attrs: {
			src: "https://res.cloudinary.com/acme/raw/upload/a.pdf",
			name: "a.pdf",
		},
	};
	assert.doesNotThrow(() => checkDoc(doc(coloured, code, file)));
	assert.throws(
		() =>
			checkDoc(
				doc({
					...code,
					attrs: { themes: { light: "x;color:red", dark: "y" } },
				}),
			),
		/Bad note content/,
	);
	assert.throws(
		() => checkDoc(doc({ ...file, attrs: { src: "javascript:alert(1)" } })),
		/can't be shown/,
	);
	assert.throws(
		() =>
			checkDoc(doc({ ...file, attrs: { src: "https://evil.example/a.pdf" } })),
		/can't be shown/,
	);
});
