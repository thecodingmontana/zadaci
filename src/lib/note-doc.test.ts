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
