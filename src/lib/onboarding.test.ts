import assert from "node:assert/strict";
import { test } from "node:test";
import { slugify } from "./onboarding";

test("workspace URLs keep accented letters as plain ones", () => {
	assert.equal(slugify("Été"), "ete");
	assert.equal(slugify("Café Ñandú Studio"), "cafe-nandu-studio");
	assert.equal(slugify("  Acme, Inc!  "), "acme-inc");
	assert.equal(slugify("東京"), "");
});
