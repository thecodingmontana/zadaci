import { useEffect, useState } from "react";
import { BUILD } from "#/lib/build";

// A thin bar at the top of every page, for two things the page can't fix by itself:
// - offline: changes won't save until the connection is back (with Try again)
// - a new version is out: a tab, or the installed app, that's been open since before a deploy
//   runs old code (missing pages read "Page not found"), so it offers a reload.

const CHECK_EVERY_MS = 15 * 60_000;

/** Whether the server runs a different build than this page; null when it can't be reached. */
export async function newerBuild(fetcher: typeof fetch = fetch) {
	try {
		const res = await fetcher("/api/version", { cache: "no-store" });
		if (!res.ok) return null;
		const { build } = (await res.json()) as { build?: string };
		return !!build && build !== BUILD;
	} catch {
		return null;
	}
}

export function AppStatus() {
	const [offline, setOffline] = useState(false);
	const [update, setUpdate] = useState(false);
	const [checking, setChecking] = useState(false);

	useEffect(() => {
		setOffline(!navigator.onLine);
		const check = () =>
			void newerBuild().then((newer) => {
				if (newer) setUpdate(true);
			});
		const onOnline = () => {
			setOffline(false);
			check();
		};
		const onOffline = () => setOffline(true);
		const onShow = () => document.visibilityState === "visible" && check();
		// a page split into chunks after a deploy: the old chunk is gone, so the new version is out
		const onStale = (event: Event) => {
			event.preventDefault();
			setUpdate(true);
		};
		window.addEventListener("online", onOnline);
		window.addEventListener("offline", onOffline);
		window.addEventListener("vite:preloadError", onStale);
		document.addEventListener("visibilitychange", onShow);
		const timer = setInterval(check, CHECK_EVERY_MS);
		check();
		return () => {
			window.removeEventListener("online", onOnline);
			window.removeEventListener("offline", onOffline);
			window.removeEventListener("vite:preloadError", onStale);
			document.removeEventListener("visibilitychange", onShow);
			clearInterval(timer);
		};
	}, []);

	if (offline)
		return (
			<div className="app-status offline" role="alert">
				<span
					className="icon-[solar--wi-fi-router-minimalistic-linear] size-[15px] shrink-0"
					aria-hidden="true"
				/>
				<span className="grow">
					<b>You're offline.</b> Changes won't be saved until your connection is
					back.
				</span>
				<button
					type="button"
					className="btn btn-sm btn-secondary"
					disabled={checking}
					onClick={() => {
						setChecking(true);
						// the browser's own flag can lag: ask the server
						void newerBuild().then((newer) => {
							setChecking(false);
							if (newer !== null) setOffline(false);
							if (newer) setUpdate(true);
						});
					}}
				>
					{checking ? "Checking…" : "Try again"}
				</button>
			</div>
		);
	if (update)
		return (
			<div className="app-status update" role="status">
				<span
					className="icon-[solar--refresh-circle-linear] size-[15px] shrink-0"
					aria-hidden="true"
				/>
				<span className="grow">
					<b>A new version of Zadaci is ready.</b> Reload to get the latest
					pages and fixes.
				</span>
				<button
					type="button"
					className="btn btn-sm btn-primary"
					onClick={() => window.location.reload()}
				>
					Reload
				</button>
			</div>
		);
	return null;
}
