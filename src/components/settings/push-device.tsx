import { useApolloClient, useMutation } from "@apollo/client/react";
import { useEffect, useState } from "react";
import {
	PUSH_PUBLIC_KEY,
	SUBSCRIBE_PUSH,
	TEST_PUSH,
	UNSUBSCRIBE_PUSH,
} from "#/graphql/operations";
import { toast } from "#/lib/toast";
import { cn } from "#/lib/utils";
import { SRow } from "./ui";

// Settings → Push: turns push notifications on or off for the browser or phone in hand.

type State = "loading" | "unsupported" | "denied" | "off" | "on";

const supported = () =>
	"serviceWorker" in navigator &&
	"PushManager" in window &&
	"Notification" in window;

// the push key comes as base64url; subscribe() wants raw bytes
const keyBytes = (key: string) =>
	Uint8Array.from(atob(key.replace(/-/g, "+").replace(/_/g, "/")), (c) =>
		c.charCodeAt(0),
	);

async function currentSubscription() {
	const reg = await navigator.serviceWorker.getRegistration("/");
	return (await reg?.pushManager.getSubscription()) ?? null;
}

const DESC: Record<State, string> = {
	loading: "Checking this device…",
	unsupported:
		"This browser can't receive push notifications. On iPhone or iPad, add Zadaci to your Home Screen first, then open it from there.",
	denied:
		"Notifications are blocked for Zadaci in this browser. Allow them in the site settings, then come back.",
	off: "Push is off on this device. Turn it on to choose what reaches you here; each browser or phone is turned on separately.",
	on: "This device gets push notifications for the choices below.",
};

/** `onChange` tells the page whether this device gets pushes, so it can grey out the choices. */
export function PushDevice({ onChange }: { onChange: (on: boolean) => void }) {
	const client = useApolloClient();
	const [subscribe] = useMutation(SUBSCRIBE_PUSH);
	const [unsubscribe] = useMutation(UNSUBSCRIBE_PUSH);
	const [test] = useMutation(TEST_PUSH);
	const [state, setState] = useState<State>("loading");
	const [busy, setBusy] = useState(false);
	useEffect(() => onChange(state === "on"), [state, onChange]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: checks this device once, on open
	useEffect(() => {
		if (!supported()) return setState("unsupported");
		if (Notification.permission === "denied") return setState("denied");
		currentSubscription()
			.then(async (sub) => {
				// re-save it, so the server knows this device even if it forgot it
				if (sub) await save(sub);
				setState(sub ? "on" : "off");
			})
			.catch(() => setState("off"));
	}, []);

	async function save(sub: PushSubscription) {
		const { endpoint, keys } = sub.toJSON();
		if (!endpoint || !keys?.p256dh || !keys.auth)
			throw new Error("The browser returned an incomplete subscription.");
		await subscribe({
			variables: { endpoint, p256dh: keys.p256dh, auth: keys.auth },
		});
	}

	async function turnOn() {
		const { data } = await client.query({ query: PUSH_PUBLIC_KEY });
		if (!data?.pushPublicKey)
			throw new Error("Push isn't set up on the server yet.");
		const permission = await Notification.requestPermission();
		if (permission !== "granted") {
			if (permission === "denied") setState("denied");
			throw new Error("Notifications weren't allowed.");
		}
		const reg = await navigator.serviceWorker.register("/sw.js", {
			updateViaCache: "none",
		});
		await navigator.serviceWorker.ready;
		const sub = await reg.pushManager.subscribe({
			userVisibleOnly: true,
			applicationServerKey: keyBytes(data.pushPublicKey),
		});
		await save(sub);
		setState("on");
	}

	async function turnOff() {
		const sub = await currentSubscription();
		if (sub) {
			await unsubscribe({ variables: { endpoint: sub.endpoint } });
			await sub.unsubscribe();
		}
		setState("off");
	}

	const run = (job: () => Promise<void>, done: string) => {
		setBusy(true);
		job()
			.then(() => toast.success(done))
			.catch((error: Error) =>
				toast.error("Couldn't change push notifications", {
					desc: error.message,
				}),
			)
			.finally(() => setBusy(false));
	};

	return (
		<SRow t="This device" d={DESC[state]}>
			{state === "on" && (
				<button
					type="button"
					className="btn"
					disabled={busy}
					onClick={() =>
						test()
							.then(({ data }) =>
								data?.testPush
									? toast.success("Test notification sent")
									: toast.error("No device got it", {
											desc: "Turn push off and on again here.",
										}),
							)
							.catch((error: Error) =>
								toast.error("Couldn't send a test", { desc: error.message }),
							)
					}
				>
					Send a test
				</button>
			)}
			{(state === "on" || state === "off") && (
				<button
					type="button"
					className={cn(
						"btn",
						state === "off" && "btn-primary",
						busy && "is-loading",
					)}
					disabled={busy}
					onClick={() =>
						state === "on"
							? run(turnOff, "Push notifications turned off here")
							: run(turnOn, "Push notifications turned on here")
					}
				>
					{state === "on" ? "Turn off" : "Turn on"}
				</button>
			)}
		</SRow>
	);
}
