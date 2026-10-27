import assert from "node:assert/strict";
import { after, test } from "node:test";
import { auth } from "#/lib/auth";
import { cleanup, makeUser } from "./helpers";

after(cleanup);

const setImage = (cookie: string, image: string | null) =>
	auth.handler(
		new Request("http://localhost:3000/api/auth/update-user", {
			method: "POST",
			headers: { cookie, "content-type": "application/json", origin: "http://localhost:3000" },
			body: JSON.stringify({ image }),
		}),
	);

test("a profile picture can't point at an outside server", async () => {
	const amina = await makeUser("amina");
	assert.equal((await setImage(amina.cookie, "https://tracker.example/pixel.png")).status, 400);
	assert.equal((await setImage(amina.cookie, "http://images.unsplash.com/photo-1")).status, 400, "https only");
	assert.equal((await setImage(amina.cookie, "https://images.unsplash.com/photo-1?w=512")).status, 200);
	assert.equal((await setImage(amina.cookie, "https://api.dicebear.com/9.x/shapes/svg?seed=abc123")).status, 200);
	assert.equal((await setImage(amina.cookie, null)).status, 200, "removing it is fine");
});
