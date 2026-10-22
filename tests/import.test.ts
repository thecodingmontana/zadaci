import assert from "node:assert/strict";
import { after, test } from "node:test";
import { cleanup, gql, makeUser, makeWorkspace } from "./helpers";

after(cleanup);

const IMPORT = `mutation($s: String!, $i: [ImportedBookmark!]!) { importBookmarks(slug: $s, items: $i) { added skipped } }`;

test("importing bookmarks adds new links once, turns folders into tags and skips the rest", async () => {
	const owner = await makeUser("owner");
	const { slug } = await makeWorkspace(owner);
	await gql(owner, `mutation($s: String!) { createBookmark(slug: $s, input: { url: "https://saved.example.com/", title: "Saved" }) { id } }`, { s: slug });

	const res = await gql(owner, IMPORT, {
		s: slug,
		i: [
			{ url: "https://figma.com/file/1", title: "Figma", tag: "Design" },
			{ url: "https://figma.com/file/1", title: "Figma again" },
			{ url: "https://saved.example.com/", title: "Already there" },
			{ url: "ftp://old.example.com", title: "Not a web link" },
			{ url: "https://notitle.example.com/page", title: "" },
		],
	});
	assert.deepEqual(res.data?.importBookmarks, { added: 2, skipped: 3 });

	const list = (await gql(owner, `query($s: String!) { bookmarks(slug: $s) { url title tags } }`, { s: slug })).data?.bookmarks as { url: string; title: string; tags: string[] }[];
	const figma = list.find((b) => b.url.startsWith("https://figma.com"));
	assert.deepEqual(figma?.tags, ["Design"]);
	assert.equal(list.find((b) => b.url.startsWith("https://notitle"))?.title, "notitle.example.com", "no title: the site's name");

	const tooMany = Array.from({ length: 1001 }, (_, n) => ({ url: `https://x.example.com/${n}` }));
	assert.ok((await gql(owner, IMPORT, { s: slug, i: tooMany })).errors, "one file at a time stays under 1000");
	assert.ok((await gql(await makeUser("outsider"), IMPORT, { s: slug, i: [] })).errors, "outsiders can't import");
});
