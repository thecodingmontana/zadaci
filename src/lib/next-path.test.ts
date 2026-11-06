import assert from "node:assert/strict";
import { safePath } from "./next-path";

assert.equal(safePath("/join/ABC"), "/join/ABC");
assert.equal(safePath("//evil.com"), undefined);
assert.equal(safePath("/\\evil.com"), undefined);
assert.equal(safePath("https://evil.com"), undefined);
assert.equal(safePath("/\t/evil.com"), undefined, "a tab browsers drop");
assert.equal(safePath("/\n/evil.com"), undefined);
assert.equal(safePath("/w/acme?task=1#c"), "/w/acme?task=1#c", "query and hash stay");
assert.equal(safePath(undefined), undefined);
console.log("next-path ok");
