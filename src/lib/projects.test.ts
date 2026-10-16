import assert from "node:assert/strict";
import { makeKey } from "./projects";

assert.equal(makeKey("Website Redesign"), "WR");
assert.equal(makeKey("Mobile App Launch Plan"), "MAL");
assert.equal(makeKey("Q4"), "Q");
assert.equal(makeKey("design"), "DES", "one word uses its first letters");
assert.equal(makeKey("123"), "PRJ");
assert.equal(makeKey("Website Redesign", ["WR", "WRX"]), "WRXX");
console.log("projects ok");
