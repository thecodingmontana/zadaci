import assert from "node:assert/strict";
import { test } from "node:test";
import { coverBackground, isCover } from "./note-covers";

test("covers are gallery keys or https links that can't break out of CSS url()", () => {
	assert.equal(isCover("gallery:ocean"), true);
	assert.equal(isCover("gallery:nope"), false);
	assert.equal(
		isCover("https://res.cloudinary.com/x/image/upload/a.jpg"),
		true,
	);
	assert.equal(isCover("http://example.com/a.jpg"), false);
	assert.equal(isCover('https://x.com/a.jpg");background:url(evil'), false);
	assert.equal(isCover("javascript:alert(1)"), false);
	assert.deepEqual(coverBackground("gallery:coral"), { background: "#e85d5d" });
	assert.equal(
		coverBackground("https://x.com/a.jpg", 140)?.backgroundPosition,
		"center 100%",
	);
});
