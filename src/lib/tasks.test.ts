import assert from "node:assert/strict";
import { test } from "node:test";
import { inlineMarks } from "./tasks";

test("typed **bold** and *italic* become real formatting", () => {
	assert.equal(inlineMarks("make it **bold** now"), "make it <b>bold</b> now");
	assert.equal(
		inlineMarks("*slanted* and _also_"),
		"<i>slanted</i> and <i>also</i>",
	);
	assert.equal(inlineMarks("<p>**a** b</p>"), "<p><b>a</b> b</p>");
});

test("asterisks and underscores that aren't marks stay as typed", () => {
	assert.equal(inlineMarks("2 * 3 * 4"), "2 * 3 * 4");
	assert.equal(inlineMarks("snake_case_name"), "snake_case_name");
	assert.equal(inlineMarks("**open <b>tag</b>**"), "**open <b>tag</b>**");
});
