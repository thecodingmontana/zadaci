import assert from "node:assert/strict";
import { safePath } from "./next-path";

assert.equal(safePath("/join/ABC"), "/join/ABC");
assert.equal(safePath("//evil.com"), undefined);
assert.equal(safePath("/\\evil.com"), undefined);
assert.equal(safePath("https://evil.com"), undefined);
assert.equal(safePath(undefined), undefined);
console.log("next-path ok");
