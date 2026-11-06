import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { spaced, whenSeen } from "./live-updates";

test("a burst of live events makes one refresh, and refreshes keep their gap", () => {
	mock.timers.enable({ apis: ["setTimeout", "Date"], now: Date.now() });
	try {
		let runs = 0;
		const refresh = spaced(() => runs++, 10_000);
		for (let i = 0; i < 50; i++) refresh();
		mock.timers.tick(400);
		assert.equal(runs, 1, "fifty messages, one refresh");

		refresh();
		mock.timers.tick(5_000);
		assert.equal(runs, 1, "not again inside the gap");
		mock.timers.tick(5_000);
		assert.equal(runs, 2, "once the gap is over");

		refresh();
		refresh.cancel();
		mock.timers.tick(20_000);
		assert.equal(runs, 2, "cancelled when the page closes");
	} finally {
		mock.timers.reset();
	}
});

test("a tab in the background doesn't reload on changes; it catches up once when shown", () => {
	let runs = 0;
	const run = Object.assign(() => runs++, { cancel: () => {} });
	const listeners: (() => void)[] = [];
	const page = {
		visibilityState: "hidden" as DocumentVisibilityState,
		addEventListener: (_: string, fn: () => void) => listeners.push(fn),
		removeEventListener: () => {},
	} as unknown as Document;
	const refresh = whenSeen(run, page);
	for (let i = 0; i < 20; i++) refresh();
	assert.equal(runs, 0, "twenty changes while hidden, no reloads");
	(page as { visibilityState: string }).visibilityState = "visible";
	for (const fn of listeners) fn();
	assert.equal(runs, 1, "one catch-up when the tab is shown");
	for (const fn of listeners) fn();
	assert.equal(runs, 1, "and not again for nothing new");
	refresh();
	assert.equal(runs, 2, "a visible tab refreshes as before");
});
