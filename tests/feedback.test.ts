import assert from "node:assert/strict";
import { after, mock, test } from "node:test";
import { SUPPORT_EMAIL } from "#/components/shell/credits";
import { cleanup, gql, makeUser } from "./helpers";

after(cleanup);

// Send feedback: a bug, idea or anything else goes to the support inbox (with no email key, as in
// tests, the email is logged instead of sent), and nobody can flood it.
const SEND = `mutation($k: String!, $m: String!) { sendFeedback(kind: $k, message: $m, slug: "acme", page: "/w/acme/calendar", browser: "Chrome on Windows") }`;

test("feedback: checked, sent to the support inbox, and limited to 5 an hour", async () => {
	const me = await makeUser("feedback-sender", false);
	const log = mock.method(console, "info", () => {});
	try {
		assert.match((await gql(me, SEND, { k: "rant", m: "hi" })).errors?.[0].message ?? "", /bug, idea or other/);
		assert.match((await gql(me, SEND, { k: "bug", m: "   " })).errors?.[0].message ?? "", /few words/);

		assert.equal((await gql(me, SEND, { k: "bug", m: "Calendar skips a day\nwhen I drag across months" })).data?.sendFeedback, true);
		const line = String(log.mock.calls.at(-1)?.arguments[0]);
		assert.match(line, /\[Bug report\] Calendar skips a day/, "the subject says what it is");
		assert.ok(line.includes(SUPPORT_EMAIL), "it goes to the support inbox");

		for (let i = 0; i < 4; i++) await gql(me, SEND, { k: "idea", m: `idea ${i}` });
		assert.match((await gql(me, SEND, { k: "idea", m: "one more" })).errors?.[0].message ?? "", /5 this hour/);
	} finally {
		log.mock.restore();
	}
});
