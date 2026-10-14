import type { ReactNode } from "react";

export type ToastType = "success" | "error" | "info" | "pending";

export type ToastPosition =
	| "top-left"
	| "top-center"
	| "top-right"
	| "bottom-left"
	| "bottom-center"
	| "bottom-right";

export interface ToastAction {
	label: string;
	icon?: ReactNode;
	onClick?: () => void;
}

export interface ToastInput {
	title: string;
	desc?: string;
	type?: ToastType;
	duration?: number;
	position?: ToastPosition;
	action?: ToastAction;
}

export type ToastData = ToastInput & {
	id: number;
	type: ToastType;
	duration: number;
};

const EMPTY: ToastData[] = [];
let list: ToastData[] = EMPTY;
let uid = 0;
const listeners = new Set<() => void>();

function set(next: ToastData[]) {
	list = next;
	for (const l of listeners) l();
}

export function subscribe(listener: () => void) {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
}

export const getSnapshot = () => list;
export const getServerSnapshot = () => EMPTY;

function defaultDuration(type: ToastType) {
	return type === "pending" ? 0 : type === "error" ? 5200 : 4200;
}

function push(input: ToastInput): number {
	const id = ++uid;
	const type = input.type ?? "info";
	const duration = input.duration ?? defaultDuration(type);
	set([{ ...input, id, type, duration }, ...list]);
	return id;
}

function dismiss(id: number) {
	set(list.filter((t) => t.id !== id));
}

function update(id: number, patch: Partial<ToastInput>) {
	set(
		list.map((t) => {
			if (t.id !== id) return t;
			const next = { ...t, ...patch } as ToastData;
			if (
				patch.duration === undefined &&
				patch.type &&
				patch.type !== "pending"
			) {
				next.duration = defaultDuration(patch.type);
			}
			return next;
		}),
	);
}

export const toast = Object.assign((input: ToastInput) => push(input), {
	success: (title: string, o: Partial<ToastInput> = {}) =>
		push({ ...o, title, type: "success" }),
	error: (title: string, o: Partial<ToastInput> = {}) =>
		push({ ...o, title, type: "error" }),
	info: (title: string, o: Partial<ToastInput> = {}) =>
		push({ ...o, title, type: "info" }),
	pending: (title: string, o: Partial<ToastInput> = {}) =>
		push({ ...o, title, type: "pending", duration: 0 }),
	dismiss,
	update,
	promise<T>(
		run: Promise<T>,
		msg: {
			loading: string;
			success: string | ((v: T) => string);
			error: string | ((err: unknown) => string);
			desc?: string;
			errorDesc?: string;
			position?: ToastPosition;
		},
	) {
		const id = push({
			title: msg.loading,
			type: "pending",
			duration: 0,
			position: msg.position,
		});
		run
			.then((v) =>
				update(id, {
					title:
						typeof msg.success === "function" ? msg.success(v) : msg.success,
					desc: msg.desc,
					type: "success",
				}),
			)
			.catch((err) =>
				update(id, {
					title: typeof msg.error === "function" ? msg.error(err) : msg.error,
					desc: msg.errorDesc ?? msg.desc,
					type: "error",
				}),
			);
		return id;
	},
});
