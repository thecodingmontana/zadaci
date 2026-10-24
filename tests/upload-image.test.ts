import assert from "node:assert/strict";
import { after, test } from "node:test";
import { Route } from "#/routes/api/upload/image";
import { cleanup, join, makeUser, makeWorkspace } from "./helpers";

after(cleanup);

type Post = (ctx: { request: Request }) => Promise<Response>;
const post = (Route.options.server?.handlers as unknown as { POST: Post }).POST;

const send = (cookie: string | null, fields: Record<string, string | Blob>) => {
	const form = new FormData();
	for (const [k, v] of Object.entries(fields)) form.set(k, v);
	return post({
		request: new Request("http://test/api/upload/image", {
			method: "POST",
			body: form,
			headers: cookie ? { cookie } : {},
		}),
	});
};
const png = (bytes: number) => new File([new Uint8Array(bytes)], "a.png", { type: "image/png" });

test("pictures are checked before anything is uploaded", async () => {
	const owner = await makeUser("owner");
	const member = await makeUser("member");
	const { slug, inviteCode } = await makeWorkspace(owner);
	await join(member, inviteCode);

	assert.equal((await send(null, { file: png(10), kind: "avatar" })).status, 401);
	const text = new File(["hi"], "a.txt", { type: "text/plain" });
	assert.equal((await send(owner.cookie, { file: text, kind: "avatar" })).status, 400);
	const big = await send(owner.cookie, { file: png(5 * 1024 * 1024 + 1), kind: "avatar" });
	assert.equal(big.status, 400);
	assert.match((await big.json()).error, /5 MB/);
	const notAdmin = await send(member.cookie, { file: png(10), kind: "workspace", slug });
	assert.equal(notAdmin.status, 403, "a member can't change the workspace picture");
	assert.equal((await send(owner.cookie, { file: png(10), kind: "avatar" })).status, 400, "not a real image");
});
