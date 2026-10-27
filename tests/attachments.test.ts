import assert from "node:assert/strict";
import { after, test } from "node:test";
import { cleanup, gql, makeUser, makeWorkspace } from "./helpers";

after(cleanup);

const SLOT = `mutation($s: String!, $t: ID) { attachmentUpload(slug: $s, taskId: $t) { publicId folder } }`;
const ADD = `mutation($s: String!, $t: ID, $u: String!, $n: String!, $m: String) {
	addAttachment(slug: $s, taskId: $t, url: $u, name: $n, mime: $m, size: 1) { id } }`;

test("a file over its size limit is refused and deleted from Cloudinary, even if the browser lied", async () => {
	const owner = await makeUser("owner");
	const { slug } = await makeWorkspace(owner);
	const task = (await gql(owner, `query($s: String!) { workspace(slug: $s) { tasks { id } } }`, { s: slug })).data
		?.workspace.tasks[0];
	const cloud = process.env.CLOUDINARY_CLOUD_NAME;

	// stand in for Cloudinary: report each uploaded file's real size, and note deletions
	const deleted: string[] = [];
	const realFetch = globalThis.fetch;
	globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
		const url = String(input);
		if (init?.method === "HEAD")
			return new Response(null, {
				headers: { "content-length": String(url.includes("/video/") ? 30 * 1024 * 1024 : 1024 * 1024) },
			});
		if (url.endsWith("/destroy")) {
			deleted.push(String((init?.body as FormData).get("public_id")));
			return Response.json({ result: "ok" });
		}
		return realFetch(input, init);
	}) as typeof fetch;
	try {
		const slot = async () =>
			(await gql(owner, SLOT, { s: slug, t: task.id })).data?.attachmentUpload as { publicId: string; folder: string };

		const big = await slot();
		const bigUrl = `https://res.cloudinary.com/${cloud}/video/upload/v1/${big.folder}/${big.publicId}.mp4`;
		const refused = await gql(owner, ADD, { s: slug, t: task.id, u: bigUrl, n: "clip.mp4", m: "video/mp4" });
		assert.match(refused.errors?.[0]?.message ?? "", /over 20 MB/);
		assert.deepEqual(deleted, [`${big.folder}/${big.publicId}`], "the oversized file is removed");

		const small = await slot();
		const smallUrl = `https://res.cloudinary.com/${cloud}/image/upload/v1/${small.folder}/${small.publicId}.png`;
		const ok = await gql(owner, ADD, { s: slug, t: task.id, u: smallUrl, n: "shot.png", m: "image/png" });
		assert.ok(ok.data?.addAttachment?.id, JSON.stringify(ok.errors));
	} finally {
		globalThis.fetch = realFetch;
	}
});
