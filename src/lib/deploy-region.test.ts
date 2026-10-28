import assert from "node:assert/strict";
import { test } from "node:test";
import { checkRegions, databaseRegion } from "./deploy-region";

const pooler = (region: string) =>
	`postgresql://u:p@aws-1-${region}.pooler.supabase.com:6543/postgres`;

test("a build fails when the database and the server are in different regions", () => {
	assert.equal(databaseRegion(pooler("eu-central-1")), "fra1");
	assert.equal(databaseRegion(pooler("us-east-1")), "iad1");
	assert.doesNotThrow(() => checkRegions(pooler("eu-central-1")));
	assert.throws(() => checkRegions(pooler("us-east-1")), /next to iad1/);
	assert.throws(() => checkRegions(pooler("mars-north-9")), /unknown/);
	// a local database, or none at all (a local build), isn't checked
	assert.doesNotThrow(() => checkRegions("postgres://u:p@localhost:5432/db"));
	assert.doesNotThrow(() => checkRegions(undefined));
});
