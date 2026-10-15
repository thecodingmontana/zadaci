import assert from "node:assert/strict";
import { dicebearUrl, isDicebearUrl, randomAvatars } from "./dicebear";

for (const a of randomAvatars(24)) assert.ok(isDicebearUrl(a.url), a.url);
assert.ok(isDicebearUrl(dicebearUrl("shapes", "abc123")));
assert.ok(
	!isDicebearUrl(
		"https://api.dicebear.com/9.x/shapes/svg?seed=abc123&backgroundColor=red",
	),
);
assert.ok(
	!isDicebearUrl("https://api.dicebear.com/9.x/unknown/svg?seed=abc123"),
);
assert.ok(!isDicebearUrl("https://evil.com/9.x/shapes/svg?seed=abc123"));
assert.ok(
	!isDicebearUrl("https://api.dicebear.com/9.x/shapes/svg?seed=<script>"),
);
assert.ok(!isDicebearUrl("not a url"));
console.log("dicebear ok");
