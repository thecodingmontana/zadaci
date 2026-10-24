import assert from "node:assert/strict";
import { after, test } from "node:test";
import { and, eq, isNull } from "drizzle-orm";
import { db, tables } from "#/db";
import { exportAccount } from "#/lib/account.server";
import { cleanup, gql, join, makeUser, makeWorkspace } from "./helpers";

after(cleanup);

const DELETE = `mutation($e: String!) { deleteMyAccount(email: $e) }`;

test("an owner of a shared workspace has to hand it over before deleting the account", async () => {
	const owner = await makeUser("owner");
	const member = await makeUser("member");
	const { inviteCode } = await makeWorkspace(owner);
	await join(member, inviteCode);
	const preview = (await gql(owner, `{ accountDeletion { blockers solo } }`)).data?.accountDeletion;
	assert.equal(preview.blockers.length, 1);
	const res = await gql(owner, DELETE, { e: owner.email });
	assert.match(res.errors?.[0]?.message ?? "", /Hand over/);
	assert.match((await gql(owner, DELETE, { e: "wrong@x.y" })).errors?.[0]?.message ?? "", /Type your email/);
});

test("deleting erases the person, leaves their workspaces, and drops the ones only they used", async () => {
	const owner = await makeUser("owner");
	const amina = await makeUser("amina");
	const { inviteCode } = await makeWorkspace(owner);
	await join(amina, inviteCode);
	const { slug: soloSlug } = await makeWorkspace(amina);

	const data = await exportAccount(amina.id);
	assert.equal(data.profile?.email, amina.email);
	assert.equal(data.workspaces.length, 2);

	assert.equal((await gql(amina, DELETE, { e: amina.email.toUpperCase() })).data?.deleteMyAccount, true);
	const [row] = await db.select().from(tables.user).where(eq(tables.user.id, amina.id));
	assert.equal(row?.name, "Deleted user");
	assert.ok(!row?.email.includes("amina"), "the email is gone");
	assert.equal((await db.select().from(tables.session).where(eq(tables.session.userId, amina.id))).length, 0);
	const active = await db
		.select()
		.from(tables.workspace_members)
		.where(and(eq(tables.workspace_members.user_id, amina.id), isNull(tables.workspace_members.deleted_at)));
	assert.equal(active.length, 0, "left every workspace");
	const [solo] = await db.select().from(tables.workspace).where(eq(tables.workspace.slug, soloSlug));
	assert.equal(solo, undefined, "the workspace only she used is deleted (its address freed)");
	assert.equal((await gql(amina, `{ me { id } }`)).data?.me ?? null, null, "her old session no longer works");
});
