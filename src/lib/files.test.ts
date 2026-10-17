import assert from "node:assert/strict";
import { isUploadUrl } from "./files";

const base = "https://res.cloudinary.com/acme";
const folder = "zadaci/tasks/MINE";
assert.equal(
	isUploadUrl(`${base}/image/upload/v17/${folder}/abc123.png`, "acme", folder),
	true,
);
assert.equal(
	isUploadUrl(`${base}/raw/upload/${folder}/abc123`, "acme", folder),
	true,
);
// another task's file with our folder smuggled into the query string
assert.equal(
	isUploadUrl(
		`${base}/raw/upload/v1/zadaci/tasks/OTHER/abc.pdf?x=/${folder}/`,
		"acme",
		folder,
	),
	false,
);
// a fetch URL proxying outside content
assert.equal(
	isUploadUrl(
		`${base}/image/fetch/https://evil.tld/${folder}/a`,
		"acme",
		folder,
	),
	false,
);
assert.equal(
	isUploadUrl(
		`https://res.cloudinary.com/other/image/upload/${folder}/abc.png`,
		"acme",
		folder,
	),
	false,
);
assert.equal(isUploadUrl("not a url", "acme", folder), false);
