import assert from "node:assert/strict";
import { test } from "node:test";
import { isEmoji } from "./emoji";

test("accepts one emoji of any kind and nothing else", () => {
	for (const ok of ["👍", "❤️", "👍🏽", "👩‍💻", "🇰🇪", "1️⃣", "🏳️‍🌈"])
		assert.ok(isEmoji(ok), ok);
	for (const bad of ["", "a", "12", "👍👍", "👍 ", "ok👍", "<b>", "#"])
		assert.ok(!isEmoji(bad), JSON.stringify(bad));
});
