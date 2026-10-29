import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { spaced } from "./live-updates";

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
